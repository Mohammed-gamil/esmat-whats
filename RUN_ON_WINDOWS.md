# 💻 One-Click Windows Setup: WhatsApp AI Sales Agent

Follow this 1-click guide to run the **WhatsApp AI Sales Agent & OpenWA Gateway** locally on any Windows laptop or PC.

---

## 🚀 How to Launch (Zero Effort)

1. Unzip the project folder on your Windows laptop.
2. **Double-click `run-agent.bat`**.

That's it! `run-agent.bat` will automatically:
- Download and install **Node.js LTS** if it's not on your laptop.
- Install required dependencies automatically.
- Initialize the local database (`dev.db`).
- Launch the background OpenWA Gateway and AI Agent.
- **Open your browser to `http://localhost:3000` automatically**.

---

## 📱 Link WhatsApp Session

1. When the browser opens (`http://localhost:3000`), go to **Step 1: Link WhatsApp Session**.
2. Click **Scan QR Code** or enter your phone number to get an 8-digit pairing code.
3. Open WhatsApp on your phone $\rightarrow$ **Linked Devices** $\rightarrow$ **Link a Device**.
4. Scan the QR code or enter the code to connect your companion line.

---

## 🛑 How to Stop the Agent

- Double-click **`stop-agent.bat`** or close the command window.
