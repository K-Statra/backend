# K-Statra

B2B 파트너 매칭 플랫폼. NestJS + MongoDB Atlas + Neo4j + XRPL.

## 구조

```
backend/   NestJS API (포트 4000)
frontend/  React + Vite (포트 5173)
```

## 빠른 시작

**백엔드**
```bash
cd backend
cp .env.example .env   # MONGODB_URI 등 설정
npm install
npm run start:dev
```

**프론트엔드**
```bash
cd frontend
npm install
npm run dev
```

Swagger UI: `http://localhost:4000/api/docs`

## 주요 환경변수 (backend/.env)

| 변수 | 설명 |
|------|------|
| `MONGODB_URI` | MongoDB Atlas SRV URI |
| `ADMIN_TOKEN` | 관리자 API 토큰 |
| `XRPL_DEST_ADDRESS` | XRPL 수취 주소 |
| `EMBEDDINGS_PROVIDER` | `mock` \| `openai` \| `huggingface` |
| `MATCH_USE_ATLAS_VECTOR` | Atlas Vector Search 사용 여부 |
| `NEO4J_URI` | Neo4j AuraDB URI (선택) |

## API 모듈

| 모듈 | 경로 | 설명 |
|------|------|------|
| Companies | `/companies` | 기업 CRUD + 이미지 관리 |
| Buyers | `/buyers` | 바이어 CRUD |
| Matches | `/matches` | 바이어 기반 매칭 + 피드백 |
| Partners | `/partners/search` | 벡터+그래프 하이브리드 파트너 검색 |
| Payments | `/payments` | XRPL 결제 생성/조회 |
| Insights | `/analytics` | 대시보드/산업/거래 통계 |
| Admin | `/admin` | 관리자 전용 (X-Admin-Token 헤더 필요) |
| Consultants | `/consultants/requests` | 컨설팅 요청 |

## Docker (로컬 MongoDB)

```bash
docker-compose up -d   # MongoDB 6 실행
```

## 빌드 및 배포

```bash
cd backend
npm run build          # dist/ 생성
npm run start:prod     # node dist/main
```

Dockerfile은 멀티스테이지 빌드로 NestJS를 컨테이너화합니다.
