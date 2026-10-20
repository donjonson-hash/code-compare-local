# Code Compare Local 0.9.0 — комплект для Chrome Web Store

Подготовлено 20 октября 2026 для кандидата 0.9.0. Принятая версия 0.8.0
дополнена welcome page и локализованными метаданными. Это комплект подготовки;
он ещё не отправлен на модерацию и не опубликован.

## Файлы

Запустить `npm run package` из корня проекта.
Комплект `dist/code-compare-local-0.9.0-store-kit.zip` содержит установочный
ZIP, изображения и тексты. Сначала распакуйте комплект; в Developer Dashboard
загружайте только вложенный `code-compare-local-0.9.0-beta.zip`.

| Поле / действие | Файл в распакованном комплекте |
| --- | --- |
| Загрузка расширения | `code-compare-local-0.9.0-beta.zip` |
| Скриншот: найденная ошибка | `screenshot-1280x800.png` |
| Скриншот: после исправления | `screenshot-fixed-1280x800.png` |
| Промо 440 × 280 | `promo-440x280.png` |
| Welcome page 1280 × 800 | `screenshot-welcome-1280x800.png` |
| Дополнительное промо 1400 × 560 | `promo-1400x560.png` |
| Иконка 128 × 128 | `icon128.png` |
| Иконки 16/32/48/64/128 | `icons/` |
| Переводы карточки | `descriptions/`, `metadata/`, `LOCALIZATION-RU.md` |
| Checklist буткемпа | `BOOTCAMP-CHECKLIST-RU.md` |
| Полное описание на английском | `FULL-DESCRIPTION-EN.txt` |

В магазин загружается beta ZIP с `manifest.json` в корне. Source ZIP содержит
исходники и документацию и не предназначен для этого поля.

## Карточка

- Name: **Code Compare Local — Beta** (английские сообщения `_locales/en/messages.json`).
- Short description: **Compare code side by side with a local code diff tool. Edit changes, check syntax, and save files offline.** (английские сообщения `_locales/en/messages.json`).
- Язык по умолчанию: English. Для остальных карточек — 21 перевод из `descriptions/`; редактор и welcome page остаются английскими.
- Homepage: https://github.com/donjonson-hash/code-compare-local
- Support: https://github.com/donjonson-hash/code-compare-local/issues
- Privacy policy: https://github.com/donjonson-hash/code-compare-local/blob/main/PRIVACY.md
- На первом этапе: бесплатная beta. Рекомендуемая начальная видимость — Unlisted,
  чтобы проверить установку по прямой ссылке до публичного продвижения. Этот
  режим не отменяет модерацию; настройка ещё не применена.

## Privacy practices — готовые формулировки

**Single purpose description**

Compare and edit two versions of a code file locally, review their differences,
check supported syntax, and save the resulting file.

**Remote code**

No, I am not using remote code.

**Пояснение к обработке данных, если форма или модератор его запрашивает**

The extension processes only the text and files the user explicitly opens,
pastes, or types into its own editor tab. Comparison and syntax checks run
locally using bundled scripts and a local worker. Editor contents, filenames,
and undo/review state are not transmitted to the developer or third parties.
Session data stays in memory until the tab is closed or reloaded. Copy and
download occur only when the user chooses those actions. There are no accounts,
analytics, advertising, telemetry, or remote services.

**Permissions**

В manifest нет API permissions и host permissions. Не добавляйте разрешения
ради заполнения формы: сравнение происходит в собственной вкладке расширения.

**Data usage**

Расширение обрабатывает введённый пользователем текст/код локально. Разработчику
данные не передаются, не продаются и не используются для рекламы или кредитных
решений. В чекбоксах формы учитывайте её точное определение сбора/обработки:
отсутствие передачи не означает отсутствия локальной обработки. Это описание
и публичная privacy policy должны совпадать с выбранными ответами. Расширение
не считывает историю посещений, содержимое других вкладок или переписки.

## Reviewer instructions

No account, login, credentials, payment, or external service is required.

1. Install the extension. The local welcome page opens only on first install.
   Click “Open editor”; updates do not reopen the guide. The toolbar icon also
   opens the editor directly.
2. Click “Try an example” to load two valid synthetic JavaScript versions.
3. Select an entry in “Differences” to jump to the changed lines. Click
   “Keep B” to mark that difference reviewed without changing the code.
4. Select another difference and click “Use A → B” to copy that block to B.
   Click “Undo”, then “Redo”, and confirm the change is removed and restored.
   These toolbar buttons act on B; Ctrl/Cmd+Z acts on the focused editor.
5. Toggle “Only changes” and “Show spaces & tabs”, then turn them off.
6. In B, paste a new line containing `const broken = ;`. Click “Check syntax”.
   Open “Show locations” under B and click the reported error to jump to it.
   Click “Undo” to remove the added line; the syntax check runs again.
7. Click “Download B”, then reopen the saved file with B's “Open file” button.
   The text and difference blocks should match the result before downloading.

“Keep B” is a review mark, not an edit; the editor's Undo does not remove that
mark. Manual text edits restart review progress. No external test files are
needed for these steps.
The extension does not execute source code. Python validation is preliminary;
TypeScript type checking and YAML schema validation are not included.

Welcome page also has “Try an example”, which opens the editor with the built-in
example. “Getting started” in the editor opens the guide in a separate tab so
existing edits are retained. Help/privacy links open GitHub only on an explicit click.

## Последовательность публикации

1. Открыть Chrome Web Store Developer Dashboard нужного аккаунта.
2. Создать новую карточку и загрузить beta ZIP.
3. Внести английское описание, изображения и три публичные ссылки выше.
   Добавить переводы карточки по `LOCALIZATION-RU.md`; сам интерфейс английский.
4. Заполнить Privacy practices по фактическому поведению из этого документа.
5. Выбрать распространение и проверить предпросмотр карточки.
6. Отправить на модерацию. После одобрения сохранить URL карточки и проверить
   установку по нему в чистом профиле Chrome.

## Официальные справочные страницы

- https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- https://developer.chrome.com/docs/webstore/images
- https://developer.chrome.com/docs/webstore/cws-dashboard-distribution

Размеры изображений, требования к beta-обозначению, режим Unlisted и поля
Privacy practices сверены с официальными страницами 20 октября 2026.
Решение о публикации принимает магазин.
