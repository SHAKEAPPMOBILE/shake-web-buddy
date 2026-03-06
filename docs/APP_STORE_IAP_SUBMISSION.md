# App Store: In-App Purchase (IAP) Submission

**Guideline 2.1(b) – Performance – App Completeness**

Apple requires that all In-App Purchase products referenced in the app be submitted for review together with the app.

## What to do in App Store Connect

1. **Create / complete IAP products**
   - In App Store Connect → Your App → **Subscriptions** (or **In-App Purchases**), ensure every subscription plan the app offers has a product created (e.g. monthly premium).
   - Match the **Product ID** to what the app uses (e.g. in RevenueCat or your purchase code).

2. **Add required IAP metadata**
   - For each product: reference name, description, price, and **screenshot for App Review**.
   - Apple explicitly requires an **App Review screenshot** for each IAP so reviewers can see the purchase flow.

3. **Submit IAP with the app**
   - Attach the IAP products to the same app version you submit.
   - Submit a **new build** (new binary) after IAP products are configured so the build and IAP are reviewed together.

## References

- [Submit In-App Purchases for review](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/submit-in-app-purchases-for-review)
- [App Review screenshot requirement for IAP](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications#In-App-Purchase)
