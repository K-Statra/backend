# MongoDB Atlas Vector Search Setup Guide

K-Statra의 **Vector Search(의미 기반 검색)** 기능을 활성화하기 위해 MongoDB Atlas에서 `vector_index`를 생성하는 단계별 가이드입니다.

## 1. 준비 사항
- MongoDB Atlas 계정 로그인
- `k-statra-project` 클러스터 접속
- **Database User** 권한 확인 (인덱스 생성 권한 필요)

## 2. 인덱스 생성 단계

1.  **Atlas 콘솔 접속**: [MongoDB Atlas](https://cloud.mongodb.com/)에 로그인하고 해당 프로젝트/클러스터로 이동합니다.
2.  **Search 탭 이동**: 클러스터 메뉴 상단의 **"Atlas Search"** 탭을 클릭합니다.
3.  **인덱스 생성**: **"Create Search Index"** 버튼을 클릭합니다.
4.  **설정 방식 선택**: **"JSON Editor"**를 선택하고 "Next"를 클릭합니다.
5.  **Database & Collection 선택**:
    - Database: `k_statra` (또는 사용 중인 DB 이름)
    - Collection: `companies`
6.  **Index Name 입력**: `vector_index` (코드의 기본값과 일치해야 함)
7.  **JSON 설정 입력**: 아래 JSON을 복사하여 에디터에 붙여넣습니다.

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

> **주의**: `numDimensions`는 사용하는 임베딩 모델에 따라 다릅니다.
> - **OpenAI (text-embedding-3-small)**: `1536` (권장/기본값)
> - **Mock (로컬 테스트용)**: `64`
> - **HuggingFace (multilingual-e5-small)**: `384`

8.  **생성 완료**: "Next" -> "Create Search Index"를 클릭하여 생성을 완료합니다.
9.  **Buyers 컬렉션 반복**: `buyers` 컬렉션에 대해서도 동일한 과정(단계 3~8)을 반복하여 인덱스를 생성합니다.

## 3. 확인 방법
인덱스 상태가 **"Active"**로 바뀌면 생성이 완료된 것입니다. (데이터 양에 따라 1~5분 소요)

## 4. 코드 설정 확인
`.env` 파일에서 다음 설정이 올바른지 확인하세요.

```env
MATCH_USE_ATLAS_VECTOR=true
ATLAS_VECTOR_INDEX=vector_index
```
