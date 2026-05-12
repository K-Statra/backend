import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { isValidClassicAddress } from "xrpl";

@ValidatorConstraint({ name: "isXrplAddress", async: false })
export class IsXrplAddressConstraint implements ValidatorConstraintInterface {
  validate(address: any): boolean {
    // 문자열인지 확인 후 xrpl 라이브러리로 검증
    return typeof address === "string" && isValidClassicAddress(address);
  }

  defaultMessage(): string {
    return "유효하지 않은 XRPL 지갑 주소입니다.";
  }
}

/**
 * XRPL 지갑 주소 유효성 검사 데코레이터
 */
export function IsXrplAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsXrplAddressConstraint,
    });
  };
}
