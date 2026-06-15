# MultiLogicTrade

Веб-калькулятор **FINRESP** для MultiLogic: бэктест по MOEX, реальная торговля T-Bank, песочница (фейк), справки.

Отделён от [OsEngine](https://github.com/RobinZGit/OsEngine) — здесь только HTML/JS и документация торговли.

## Состав  

| Путь | Назначение |
|------|------------|
| `FinrespCalculator/` | Калculator, engine, worker, справка калькулятора |
| `MultiLogic_LogicHelp.html` | Справка по строкам логики L1…L5 |
| `MultiLogic_PolynomialIndicators.html` | Многочлены и обозначения |
| `MultiLogic_FinrespCalculator.html` | Redirect → `FinrespCalculator/` |
| `serve-calculator.ps1` | Локальный HTTP-сервер |

## Запуск

```powershell
.\serve-calculator.ps1
```

## GitHub Pages

- Индекс: https://robinzgit.github.io/MultiLogicTrade/index.html  
- Калькулятор: https://robinzgit.github.io/MultiLogicTrade/FinrespCalculator/MultiLogic_FinrespCalculator.html  

На **Android / планшете** не открывайте скачанный `index.html` из файлового менеджера (`content://…` — ссылки на соседние HTML не работают). Используйте GitHub Pages или локальный HTTP (`python -m http.server` в Termux в распакованной папке).
