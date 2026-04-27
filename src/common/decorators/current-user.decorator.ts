import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface SessionUser {
  userId: string;
  type: "buyer" | "seller";
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx.switchToHttp().getRequest();
    return { userId: req.session.userId, type: req.session.type };
  },
);
