# Implementation Plan - Data Pipeline Integration

## Goal Description
Integrate Open DART API to fetch and store company financial and disclosure data. The implementation will follow a **Layered Architecture** and enforce **IFRS Standardization** for key metrics.

## User Review Required
> [!IMPORTANT]
> **Open DART API Key**: Please provide a valid Open DART API Key to be added to the `.env` file (e.g., `OPENDART_API_KEY=...`).

## Proposed Changes

### Database Schema
#### [MODIFY] [Company.js](file:///d:/k-statra-project/src/models/Company.js)
- Verify and ensure the `dart` field structure aligns with the requirements:
    - **Layer 4 (Finance/Disclosure)**: Separated from Core, Product, and Activity layers.
    - **IFRS Standardization**:
        - `revenueConsolidated`, `operatingProfitConsolidated`, `netIncomeConsolidated` (Primary)
        - `revenueSeparate`, `operatingProfitSeparate`, `netIncomeSeparate` (Secondary)
        - `isIFRS` flag and `fiscalYear`.
- *Note: The current schema already appears to support this. Will perform a final verification.*

### Data Fetching Scripts
#### [NEW] [fetch_dart_data.js](file:///d:/k-statra-project/scripts/fetch_dart_data.js)
- **Purpose**: Fetch company list and financial data from Open DART.
- **Logic**:
    1.  **Fetch Company List**: Use `opendart.disclosure.company` (or appropriate list endpoint) to get `corp_code`.
    2.  **Filter**: Target specific companies (e.g., by name or industry) or fetch all.
    3.  **Fetch Financials**: Use `opendart.statement.fnlttSinglAcnt` (or similar) for specific years.
    4.  **Parse & Standardize**:
        - Extract Consolidated (연결) data if available.
        - Fallback to Separate (별도) if Consolidated is missing (but mark `isIFRS` or `type` accordingly).
        - Map to `Company` model fields.
    5.  **Upsert**: Update existing companies or create new ones (if strategy allows).

### Configuration
#### [MODIFY] [.env](file:///d:/k-statra-project/.env)
- Add `OPENDART_API_KEY`.

## Verification Plan

### Automated Tests
- **Script**: `node scripts/fetch_dart_data.js --dry-run`
    - Verify data is fetched and parsed correctly without saving (or save to a temp file).
- **Script**: `node scripts/fetch_dart_data.js --target "Samsung Electronics"`
    - Test with a known company to verify data accuracy.

### Manual Verification
- Check MongoDB Atlas to ensure `dart` field is populated correctly.
- Verify `revenueConsolidated` matches public data (e.g., Naver Finance).
