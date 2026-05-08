import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";

@Schema({ collection: "stream_resume_tokens" })
export class StreamResumeToken {
  @Prop({ required: true, unique: true })
  streamId: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  token: any;
}

export type StreamResumeTokenDocument = StreamResumeToken & Document;
export const StreamResumeTokenSchema =
  SchemaFactory.createForClass(StreamResumeToken);
