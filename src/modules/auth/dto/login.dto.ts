import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsNotEmpty } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "test@example.com", description: "사용자 이메일" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123", description: "비밀번호" })
  @IsString()
  @IsNotEmpty()
  password: string;
}
