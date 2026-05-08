import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { NotAuthenticatedException } from "../exceptions";

@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const type = req.session?.type;
    if (!req.session?.userId || (type !== "buyer" && type !== "seller")) {
      throw new NotAuthenticatedException();
    }
    return true;
  }
}
