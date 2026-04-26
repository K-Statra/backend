import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const adminToken = process.env.ADMIN_TOKEN || "";
    const provided = request.headers["x-admin-token"];
    if (!adminToken || provided !== adminToken) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
