import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ _id: false })
export class WalletInfo {
  @Prop({ required: true })
  address: string;

  @Prop({ required: true, select: false })
  seed: string; // AES-256-GCM 암호화된 값

  @Prop({ required: true })
  publicKey: string;
}

export const WalletInfoSchema = SchemaFactory.createForClass(WalletInfo);
