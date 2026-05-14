import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../../users/schemas/user.schema";

@Injectable()
export class UserFacade {
  constructor(
    @InjectModel(User.name)
    private readonly model: Model<UserDocument>,
  ) {}

  findById(id: string | object): Promise<UserDocument | null> {
    return this.model.findById(id).exec();
  }

  findByIdLean(id: string | object): Promise<User | null> {
    return this.model.findById(id).lean().exec();
  }

  findByIdWithSeed(id: string | object): Promise<UserDocument | null> {
    return this.model.findById(id).select("+wallet.seed").exec();
  }

  findByWalletAddressAndType(
    address: string,
    type: "buyer" | "seller",
  ): Promise<User | null> {
    return this.model
      .findOne(
        { "wallet.address": address, type },
        { _id: 1, name: 1, wallet: 1 },
      )
      .lean()
      .exec();
  }

  findByWalletAddress(address: string): Promise<User | null> {
    return this.model.findOne({ "wallet.address": address }).lean().exec();
  }
}
