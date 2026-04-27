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
    if (!req.session?.userId) {
      throw new UnauthorizedException("Login required");
    }
    return true;
  }
}
