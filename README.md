# K-Statra Backend

> AI 기반 무역 파트너 매칭 및 XRPL 에스크로 결제 플랫폼

**"33년 무역현장 경력의 노하우와 AI 매칭 기술, 그리고 XRPL의 에스크로 기능을 결합하여 중소기업의 해외 판로 개척과 안전한 무역 결제를 돕는 차세대 B2B 플랫폼"**

- 웹 데모: https://k-statra-frontend.vercel.app
- GitHub 조직: https://github.com/orgs/K-Statra/repositories

---

## 핵심 가치

| 구분 | 기존 SWIFT | K-Statra (XRPL) |
|------|-----------|-----------------|
| 수수료 | 건당 3~5% | 0.1% 미만 (90% 절감) |
| 정산 속도 | 3~5일 | 3~5초 |
| 투명성 | 이메일·서류 의존 | Tx Hash 실시간 추적 |
| 보안 | 바이어 단독 승인 | 2-of-3 Multi-sig 에스크로 |

---

## 주요 기능

### 1. AI 기반 파트너 매칭
- MongoDB Atlas Vector Search를 활용한 벡터 유사도 검색
- 벡터 검색 → 텍스트 폴백 → 웹검색 + LLM 인텐트 분석 순으로 동작
- 산업·국가·파트너십 태그 필터 지원

### 2. 하이브리드 XRPL 결제
- 소액 샘플 대금: XRP 결제 (속도 우선)
- 무역 대금: RLUSD 스테이블코인 결제 (현재 Ripple에서 에스크로 기능을 막음으로 보류)

### 3. 이벤트 기반 3단계 에스크로
- 계약 → 선적(B/L) → 수령 시점에 맞춰 대금을 단계별 분할 집행
- XRPL Native Escrow 활용 (별도 스마트 컨트랙트 불필요)
- 거래 전용 Vault 지갑 생성 + 마스터 키 비활성화로 자금 보호
- 수입자·수출자·중재자 2-of-3 Multi-sig로 분쟁 리스크 차단
- Bull Queue + Outbox 패턴으로 에스크로 생성 안정성 보장

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | NestJS (TypeScript) |
| 데이터베이스 | MongoDB Atlas (Replica Set, Vector Search) |
| 캐시 / 큐 | Redis + Bull |
| 블록체인 | XRPL (xrpl.js) |
| 인프라 | Docker, Railway |
| API 문서 | Swagger (OpenAPI) |

---

## 모듈 구조

```
src/modules/
├── auth/              # 회원가입·로그인 (세션 기반)
├── users/             # 유저 스키마 (Buyer / Seller)
├── my-business/       # 내 기업 정보 관리
├── partners/          # AI 파트너 검색 (벡터·텍스트·LLM)
├── escrow-payments/   # XRPL 에스크로 결제 CRUD + 처리
├── xrpl/              # XRPL 클라이언트 서비스
├── embeddings/        # 벡터 임베딩 생성
└── outbox/            # Outbox 패턴 (Change Stream 기반)
```

## 아키텍처

graph LR
    %% Client Zone
    Client((Client\nBuyer/Seller))
    
    %% Application Zone
    subgraph "Application Layer (NestJS)"
        API[NestJS API Server]
        Auth[Auth/Session Guard]
        Logic[Business & Match Logic]
        OutboxPub[Outbox Publisher]
    end

    %% Data Zone
    subgraph "Data & Event Layer"
        Redis[(Redis\nSession)]
        Mongo[(MongoDB Replica Set\nBusiness Data & Outbox)]
        ChangeStream((Change Streams))
        Queue[(Bull Queue)]
        Worker[Escrow Worker\n& Recovery Scheduler]
    end

    %% External Zone
    subgraph "External Services"
        XRPL[XRPL Testnet]
        LLM[External LLM\n& Vector Search]
    end

    %% Flow - General
    Client -->|REST API| API
    API --> Auth
    Auth <--> Redis
    API --> Logic

    %% Flow - AI Matching
    Logic <-->|RAG / Intent| LLM
    
    %% Flow - Escrow & Outbox (Core)
    API --> OutboxPub
    OutboxPub -->|Atomic Transaction| Mongo
    Mongo -->|Watch| ChangeStream
    ChangeStream -->|Push Event| Queue
    Queue -->|Consume| Worker
    Worker <-->|EscrowCreate / Approve| XRPL
    Worker -->|Update Status| Mongo
---

## 빠른 시작

### 사전 요건

- Node.js 20+
- Docker & Docker Compose
- MongoDB Atlas 클러스터 (또는 로컬 Replica Set)

### 로컬 실행

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env에서 MONGODB_URI, XRPL_*, OPENAI_API_KEY 등 설정

# 3. MongoDB + Redis 실행
docker-compose up -d

# 4. 개발 서버 실행
npm run start:dev
```

Swagger UI: `http://localhost:4000/api/docs`

### Docker 전체 실행

```bash
docker-compose up -d
```

---

## XRPL 테스트넷 지갑

| 역할 | 주소 |
|------|------|
| Buyer | `rJvbMhFjmfAd5DZAVhXe7kuPBKmhBMkaCH` |
| Seller | `ra7MVxG3MUCqym6opZBQXj9bSx5P7s5B4Y` |

> Testnet Faucet: https://xrpl.org/xrp-testnet-faucet.html

---

## API 주요 엔드포인트

| 그룹 | 경로 | 설명 |
|------|------|------|
| Auth | `POST /auth/register` | 회원가입 |
| Auth | `POST /auth/login` | 로그인 |
| Partners | `GET /partners/search?q=` | AI 파트너 검색 |
| Escrow | `POST /escrow-payments` | 에스크로 생성 |
| Escrow | `GET /escrow-payments` | 에스크로 목록 조회 |
| Escrow | `GET /escrow-payments/users/wallet/:address` | 지갑 주소로 유저 조회 |
| My Business | `GET /my-business` | 내 기업 정보 조회 |

전체 API는 Swagger UI에서 확인하세요.

---

## 비즈니스 모델

- **서비스 수수료**: 결제액의 0.2% (네트워크 수수료 0.000012 XRP 별도)
- **AI 파트너 추천**: 구독 모델 (SaaS)
- 연간 1,000건 × 평균 $50,000 가정 시 → 연간 약 1억 원 이상 수수료 수익 목표

---
