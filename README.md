# Notion Calendar Widget

A dynamic, customizable calendar widget designed for seamless integration with Notion dashboards. Built with clean repo structure, robust frontend/backend integration, and resilient error handling.

## ✨ Features
- **ISO Week/Year Rollover**: Correctly handles transitions between years and weeks.
- **Batching**: Efficiently loads events in chunks to reduce API strain.
- **Loading Indicator**: Provides clear visual feedback during data fetches.
- **Graceful Error Handling**: Displays user‑friendly messages when API calls fail.
- **Responsive UI/UX**: Designed for clarity, beauty, and usability across devices.
- **Customizable Styling**: Easily adapt colors, fonts, and layout to match your Notion theme.

## 📦 Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/notion-calendar-widget.git
   ```
2. Navigate into the project folder:
   ```bash
   cd notion-calendar-widget
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## 🚀 Usage
1. Start the development server:
   ```bash
   npm run dev
   ```
2. Configure your Notion API key in `.env`:
   ```env
   NOTION_API_KEY=your_secret_key
   ```
3. Embed the widget in your Notion dashboard using an embed block:
   ```
   https://your-deployment-url.com
   ```

## ⚙️ Configuration
- **Batch Size**: Adjust in `config.js` to control how many events load per request.
- **Theme Options**: Modify `styles.css` for custom colors and typography.
- **Error Messages**: Customize fallback text in `errorHandler.js`.

## 🧪 Testing
Run unit tests:
```bash
npm run test
```

## 🛠️ Troubleshooting
- **Events not loading**: Check API key and batching size.
- **Year rollover issues**: Verify ISO week logic in `calendarUtils.js`.
- **UI glitches**: Inspect CSS overrides in your Notion embed.

## 📄 License
MIT License — free to use, modify, and distribute.
