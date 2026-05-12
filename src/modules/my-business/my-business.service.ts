import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Seller, SellerDocument } from "../sellers/schemas/seller.schema";
import { Buyer, BuyerDocument } from "../buyers/schemas/buyer.schema";
import {
  PartnerAlreadySavedException,
  PartnerNotFoundException,
  SavedPartnerNotFoundException,
} from "../../common/exceptions";

@Injectable()
export class MyBusinessService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Seller.name)
    private readonly sellerModel: Model<SellerDocument>,
    @InjectModel(Buyer.name)
    private readonly buyerModel: Model<BuyerDocument>,
  ) {}

  private static readonly PROFILE_PROJECTION = {
    email: 1,
    name: 1,
    contactName: 1,
    phone: 1,
    industries: 1,
    "wallet.address": 1,
    "wallet.publicKey": 1,
    status: 1,
    type: 1,
    // seller
    exportItems: 1,
    location: 1,
    sizeBucket: 1,
    // buyer
    needs: 1,
  };

  private static readonly SELLER_PARTNER_PROJECTION = {
    name: 1,
    nameEn: 1,
    industry: 1,
    tags: 1,
    location: 1,
    sizeBucket: 1,
    profileText: 1,
    updatedAt: 1,
  };

  private static readonly BUYER_PARTNER_PROJECTION = {
    name_kr: 1,
    name_en: 1,
    industry_kr: 1,
    industry_en: 1,
    country: 1,
    intro_kr: 1,
    intro_en: 1,
    website: 1,
    updatedAt: 1,
  };

  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId, MyBusinessService.PROFILE_PROJECTION)
      .lean();

    if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다.");
    return user;
  }

  async savePartner(
    userId: string,
    partnerId: string,
    partnerType: "seller" | "buyer",
  ) {
    if (!Types.ObjectId.isValid(partnerId))
      throw new SavedPartnerNotFoundException();

    const partnerObjectId = new Types.ObjectId(partnerId);

    const model: Model<any> =
      partnerType === "seller" ? this.sellerModel : this.buyerModel;
    const exists = await model.exists({ _id: partnerObjectId });
    if (!exists) throw new PartnerNotFoundException();

    const result = await this.userModel.updateOne(
      { _id: userId, "savedPartners.partnerId": { $ne: partnerObjectId } },
      { $push: { savedPartners: { partnerId: partnerObjectId, partnerType } } },
    );

    if (result.matchedCount === 0) {
      const userExists = await this.userModel.exists({ _id: userId });
      if (!userExists)
        throw new NotFoundException("사용자를 찾을 수 없습니다.");
      throw new PartnerAlreadySavedException();
    }
    return { message: "파트너가 저장되었습니다." };
  }

  async removePartner(userId: string, partnerId: string) {
    if (!Types.ObjectId.isValid(partnerId))
      throw new SavedPartnerNotFoundException();

    const result = await this.userModel.updateOne(
      { _id: userId },
      {
        $pull: { savedPartners: { partnerId: new Types.ObjectId(partnerId) } },
      },
    );
    if (result.modifiedCount === 0) throw new SavedPartnerNotFoundException();

    return { message: "파트너가 삭제되었습니다." };
  }

  async getPartners(userId: string, page: number, limit: number) {
    const user = await this.userModel
      .findById(userId, { savedPartners: 1 })
      .lean();

    if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다.");

    const savedPartners = user.savedPartners ?? [];
    const total = savedPartners.length;
    const skip = (page - 1) * limit;
    const pageSlice = savedPartners.slice(skip, skip + limit);

    const sellerIds = pageSlice
      .filter((p) => p.partnerType === "seller")
      .map((p) => p.partnerId);
    const buyerIds = pageSlice
      .filter((p) => p.partnerType === "buyer")
      .map((p) => p.partnerId);

    const [sellers, buyers] = await Promise.all([
      sellerIds.length > 0
        ? this.sellerModel
            .find(
              { _id: { $in: sellerIds } },
              MyBusinessService.SELLER_PARTNER_PROJECTION,
            )
            .lean()
        : ([] as SellerDocument[]),
      buyerIds.length > 0
        ? this.buyerModel
            .find(
              { _id: { $in: buyerIds } },
              MyBusinessService.BUYER_PARTNER_PROJECTION,
            )
            .lean()
        : ([] as BuyerDocument[]),
    ]);

    const resultMap = new Map<string, any>();
    sellers.forEach((s) =>
      resultMap.set((s._id as Types.ObjectId).toString(), {
        ...s,
        partnerType: "seller",
      }),
    );
    buyers.forEach((b) =>
      resultMap.set((b._id as Types.ObjectId).toString(), {
        ...b,
        partnerType: "buyer",
      }),
    );

    const data = pageSlice
      .map((p) => resultMap.get(p.partnerId.toString()))
      .filter(Boolean);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }
}
