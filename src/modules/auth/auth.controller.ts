import { Controller, Post, Body, Res, Req, HttpCode } from "@nestjs/common";
import { SessionDestroyException } from "../../common/exceptions";
import type { Response } from "express";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterBuyerDto, RegisterSellerDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register/seller")
  @ApiOperation({ summary: "판매자(Seller) 회원가입" })
  @ApiResponse({ status: 201, description: "회원가입 성공" })
  @ApiResponse({
    status: 400,
    description: "유효성 검사 실패 또는 중복된 이메일",
  })
  async registerSeller(@Body() dto: RegisterSellerDto) {
    return this.authService.registerSeller(dto);
  }

  @Post("register/buyer")
  @ApiOperation({ summary: "구매자(Buyer) 회원가입" })
  @ApiResponse({ status: 201, description: "회원가입 성공" })
  @ApiResponse({
    status: 409,
    description: "유효성 검사 실패 또는 중복된 이메일",
  })
  async registerBuyer(@Body() dto: RegisterBuyerDto) {
    return this.authService.registerBuyer(dto);
  }

  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "로그인 (세션 기반)" })
  @ApiResponse({ status: 200, description: "로그인 성공 및 세션 쿠키 발급" })
  @ApiResponse({
    status: 401,
    description: "인증 실패 (이메일/비밀번호 불일치)",
  })
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const user = await this.authService.login(dto);
    req.session.userId = user._id.toString();
    req.session.type = user.type;
    return { message: "로그인 성공", user };
  }

  @Post("logout")
  @HttpCode(200)
  @ApiOperation({ summary: "로그아웃 (세션 파괴)" })
  @ApiResponse({ status: 200, description: "로그아웃 성공" })
  logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    return new Promise<{ message: string }>((resolve, reject) => {
      req.session.destroy((err: unknown) => {
        if (err) {
          return reject(new SessionDestroyException());
        }
        res.clearCookie("sessionId");
        resolve({ message: "Success logout" });
      });
    });
  }
}
