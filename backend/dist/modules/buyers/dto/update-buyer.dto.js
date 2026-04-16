"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBuyerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const create_buyer_dto_1 = require("./create-buyer.dto");
class UpdateBuyerDto extends (0, swagger_1.PartialType)(create_buyer_dto_1.CreateBuyerDto) {
}
exports.UpdateBuyerDto = UpdateBuyerDto;
//# sourceMappingURL=update-buyer.dto.js.map