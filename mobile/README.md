# LP Management Mobile

A separate Expo React Native app for LP Management, kept isolated from the Next.js web app.

## Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm i -g expo` optional)

## Setup
```bash
cd mobile
npm install
```

Create `.env` or use Expo env:
```
EXPO_PUBLIC_API_BASE_URL=https://r1iqp059n5.execute-api.eu-west-2.amazonaws.com/dev
```

## Run
```bash
npm start        # launch Expo dev tools
npm run android  # run on Android Emulator / device
npm run ios      # run on iOS Simulator / device
npm run web      # optional web preview
```

## Notes
- No changes are made to the existing web application.
- Nothing will be pushed without your explicit confirmation.
