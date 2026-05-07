import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";

@Injectable()
export class MyBusinessService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private static readonly PROFILE_PROJECTION = {
    email: 1,
    name: 1,
    contactName: 1,
    phone: 1,
    industries: 1,
    wallet: 1,
    status: 1,
    type: 1,
    // seller
    exportItems: 1,
    location: 1,
    sizeBucket: 1,
    // buyer
    needs: 1,
  };

  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId, MyBusinessService.PROFILE_PROJECTION)
      .lean();

    if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다.");
    return user;
  }
}
