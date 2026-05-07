import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { NotAuthenticatedException } from "../exceptions";

export interface SessionUser {
  userId: string;
  type: "buyer" | "seller";
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx.switchToHttp().getRequest();
    if (!req.session?.userId || !req.session?.type) {
      throw new NotAuthenticatedException();
    }
    return { userId: req.session.userId, type: req.session.type };
  },
);
