import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";

export class DuplicateEmailException extends ConflictException {
  constructor() {
    super("Already registered Email");
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super("이메일 또는 비밀번호가 올바르지 않습니다.");
  }
}

export class NotAuthenticatedException extends UnauthorizedException {
  constructor() {
    super("User not authenticated");
  }
}

export class SessionDestroyException extends InternalServerErrorException {
  constructor() {
    super("Failed to destroy session");
  }
}
