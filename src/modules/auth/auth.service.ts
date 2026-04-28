import {
  Injectable,
  Logger,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as bcrypt from "bcrypt";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Company, CompanyDocument } from "../users/schemas/company.schema";
import { Buyer, BuyerDocument } from "../users/schemas/buyer.schema";
import { XrplService, XrplWallet } from "../payments/xrpl.service";
import { RegisterBuyerDto, RegisterSellerDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(Buyer.name) private buyerModel: Model<BuyerDocument>,
    private readonly xrplService: XrplService,
  ) {}

  async registerSeller(dto: RegisterSellerDto) {
    const exists = await this.userModel.exists({
      email: dto.representativeEmail,
    });
    if (exists) throw new ConflictException("Already registered Email");

    const wallet = this.xrplService.generateWallet();
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const newSeller = new this.companyModel({
      name: dto.companyName,
      email: dto.representativeEmail,
      contactName: dto.representativeName,
      phone: dto.representativePhone,
      password: hashedPassword,
      exportItems: dto.exportItems,
      industry: dto.industry ?? "",
      tags: dto.tags ?? [],
      companyIntroduction: dto.companyIntroduction,
      productIntroduction: dto.productIntroduction,
      websiteUrl: dto.websiteUrl,
      wallet: {
        address: wallet.address,
        seed: this.xrplService.encrypt(wallet.seed),
        publicKey: wallet.publicKey,
      },
      status: "PENDING_ACTIVATION",
    });

    const saved = await newSeller.save();
    void this.activateAccountInBackground(wallet, saved._id, "seller").catch(
      (err) =>
        this.logger.error(
          `activateAccountInBackground unhandled: ${err?.message ?? err}`,
        ),
    );
    return this.toSafeResponse(saved.toObject());
  }

  async registerBuyer(dto: RegisterBuyerDto) {
    const exists = await this.userModel.exists({
      email: dto.representativeEmail,
    });
    if (exists) throw new ConflictException("Already registered Email");

    const wallet = this.xrplService.generateWallet();
    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const newBuyer = new this.buyerModel({
      name: dto.companyName,
      email: dto.representativeEmail,
      contactName: dto.representativeName,
      phone: dto.representativePhone,
      password: hashedPassword,
      needs: dto.needs,
      industries: dto.industries ?? [],
      tags: dto.tags ?? [],
      companyIntroduction: dto.companyIntroduction,
      productIntroduction: dto.productIntroduction,
      websiteUrl: dto.websiteUrl,
      wallet: {
        address: wallet.address,
        seed: this.xrplService.encrypt(wallet.seed),
        publicKey: wallet.publicKey,
      },
      status: "PENDING_ACTIVATION",
    });

    const saved = await newBuyer.save();
    void this.activateAccountInBackground(wallet, saved._id, "buyer").catch(
      (err) =>
        this.logger.error(
          `activateAccountInBackground unhandled: ${err?.message ?? err}`,
        ),
    );
    return this.toSafeResponse(saved.toObject());
  }

  async login(dto: LoginDto) {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select("+password")
      .lean();

    if (!user)
      throw new UnauthorizedException(
        "이메일 또는 비밀번호가 올바르지 않습니다.",
      );

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch)
      throw new UnauthorizedException(
        "이메일 또는 비밀번호가 올바르지 않습니다.",
      );

    return this.toSafeResponse(user);
  }

  // XRPL 계정 활성화(펀딩)
  private async activateAccountInBackground(
    wallet: XrplWallet,
    id: Types.ObjectId,
    type: "seller" | "buyer",
  ) {
    try {
      this.logger.log(
        `Starting activation for ${type} (${String(id)}): ${wallet.address}`,
      );
      await this.xrplService.fundAccount(wallet);
      if (type === "seller") {
        await this.companyModel.updateOne({ _id: id }, { status: "ACTIVE" });
      } else {
        await this.buyerModel.updateOne({ _id: id }, { status: "ACTIVE" });
      }
      this.logger.log(`Successfully activated ${type} (${String(id)})`);
    } catch (err) {
      this.logger.error(
        `Failed to activate ${type} (${String(id)}): ${err.message}`,
      );
      try {
        if (type === "seller") {
          await this.companyModel.updateOne(
            { _id: id },
            { status: "FAILED_ACTIVATION" },
          );
        } else {
          await this.buyerModel.updateOne(
            { _id: id },
            { status: "FAILED_ACTIVATION" },
          );
        }
      } catch (innerErr) {
        this.logger.error(
          `Failed to mark FAILED_ACTIVATION ${type} (${String(id)})`,
          innerErr,
        );
      }
    }
  }

  // XRPL 계정 활성화 실패할 경우 스케줄러로 재실행
  @Cron(CronExpression.EVERY_30_MINUTES)
  async retryFailedActivations() {
    const [failedSellers, failedBuyers] = await Promise.all([
      this.companyModel.find({ status: "FAILED_ACTIVATION" }).lean(),
      this.buyerModel.find({ status: "FAILED_ACTIVATION" }).lean(),
    ]);

    if (failedSellers.length === 0 && failedBuyers.length === 0) return;

    this.logger.log(
      `Retrying activation: ${failedSellers.length} sellers, ${failedBuyers.length} buyers`,
    );

    const retryOne = async (doc: any, type: "seller" | "buyer") => {
      try {
        const seed = this.xrplService.decrypt(doc.wallet.seed);
        const wallet: XrplWallet = {
          address: doc.wallet.address,
          seed,
          publicKey: doc.wallet.publicKey,
          privateKey: "",
        };
        await this.xrplService.fundAccount(wallet);
        if (type === "seller") {
          await this.companyModel.updateOne(
            { _id: doc._id },
            { status: "ACTIVE" },
          );
        } else {
          await this.buyerModel.updateOne(
            { _id: doc._id },
            { status: "ACTIVE" },
          );
        }
        this.logger.log(`Retry activation succeeded: ${type} (${doc._id})`);
      } catch (err) {
        this.logger.warn(
          `Retry activation failed: ${type} (${doc._id}): ${err.message}`,
        );
      }
    };

    await Promise.allSettled([
      ...failedSellers.map((s) => retryOne(s, "seller")),
      ...failedBuyers.map((b) => retryOne(b, "buyer")),
    ]);
  }

  private toSafeResponse(doc: any) {
    delete doc.password;
    if (doc.wallet) delete doc.wallet.seed;
    return doc;
  }
}
