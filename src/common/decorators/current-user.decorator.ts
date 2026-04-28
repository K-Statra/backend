import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

export interface SessionUser {
  userId: string;
  type: "buyer" | "seller";
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx.switchToHttp().getRequest();
    if (!req.session?.userId || !req.session?.type) {
      throw new UnauthorizedException("User not authenticated");
    }
    return { userId: req.session.userId, type: req.session.type };
  },
);
