# Code Compare Local 0.5.0 — комплект для Chrome Web Store

Подготовлено 19 октября 2026. Это инструкция для загрузки; карточка магазина
ещё не создана и расширение не отправлено на модерацию.

## Файлы

Запустить `npm run package` из корня проекта.

| Поле / действие | Файл |
| --- | --- |
| Загрузка расширения | `dist/code-compare-local-0.5.0-beta.zip` |
| Скриншот 1280 × 800 | `store/screenshot-1280x800.png` |
| Промо 440 × 280 | `store/promo-440x280.png` |
| Иконка 128 × 128 | `icons/icon128.png` |
| Полное описание на английском | `store/LISTING-EN.md`, раздел Full description |

В магазин загружается beta ZIP с `manifest.json` в корне. Source ZIP содержит
исходники и документацию и не предназначен для этого поля.

## Карточка

- Name: **Code Compare Local — Beta** (из manifest).
- Short description: **Compare and edit code locally. Check syntax, copy changes, and save. No AI, account, or uploads.** (из manifest).
- Язык: English.
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

1. Install the extension and click its toolbar icon to open the editor.
2. Click “Try an example” to load two synthetic JavaScript versions.
3. Select an entry in “Differences” to jump to the changed lines.
4. Click “Keep B” to retain a change, or “Use A” to replace it with version A.
5. Toggle “Only changes” and “Show spaces & tabs”.
6. Edit B, click “Check syntax”, and use a reported location to navigate.
7. Click “Download B”, then reopen the saved file with B's “Open file” button.

The extension does not execute source code. Python validation is preliminary;
TypeScript type checking and YAML schema validation are not included.

## Последовательность публикации

1. Открыть Chrome Web Store Developer Dashboard нужного аккаунта.
2. Создать новую карточку и загрузить beta ZIP.
3. Внести английское описание, изображения и три публичные ссылки выше.
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

Поля и правила сверены 19 октября 2026. Решение о публикации принимает магазин.
