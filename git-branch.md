# Git 브랜치 전략

## GitFlow

- `main` : 제품을 배포
- `develop` : 개발 브랜치, 해당 브랜치를 기준으로 작업한 기능들을 merge
- `feature` : 단위 기능을 개발하는 브랜치, 개발이 완료되면 develop에 merge
- `release` : 배포를 위해 main 브랜치로 보내기 전에 QA(품질검사)
- `hotfix` : main 브랜치로 배포를 했는데 버그가 생겼을 경우 긴급 수정
