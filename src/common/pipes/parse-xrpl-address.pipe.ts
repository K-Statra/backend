import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

const XRPL_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

@Injectable()
export class ParseXrplAddressPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!XRPL_ADDRESS_REGEX.test(value)) {
      throw new BadRequestException(
        `'${value}'은(는) 유효한 XRPL 지갑 주소가 아닙니다`,
      );
    }
    return value;
  }
}
