import { ConflictException, NotFoundException } from "@nestjs/common";

export class PartnerAlreadySavedException extends ConflictException {
  constructor() {
    super("이미 저장된 파트너입니다.");
  }
}

export class PartnerNotFoundException extends NotFoundException {
  constructor() {
    super("파트너를 찾을 수 없습니다.");
  }
}

export class SavedPartnerNotFoundException extends NotFoundException {
  constructor() {
    super("저장된 파트너를 찾을 수 없습니다.");
  }
}
