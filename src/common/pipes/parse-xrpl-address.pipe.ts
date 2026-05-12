import { Injectable, PipeTransform } from "@nestjs/common";
import { isValidClassicAddress } from "xrpl";
import { InvalidXRPWalletAddressException } from "../exceptions";

@Injectable()
export class ParseXrplAddressPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== "string" || !isValidClassicAddress(value)) {
      throw new InvalidXRPWalletAddressException();
    }
    return value;
  }
}
