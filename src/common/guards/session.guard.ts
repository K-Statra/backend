import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class SessionGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const type = req.session?.type;
    if (!req.session?.userId || (type !== "buyer" && type !== "seller")) {
      throw new UnauthorizedException("User not authenticated");
    }
    return true;
  }
}
