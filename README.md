# CloudRadar 🛰️ — Multi-Cloud Monitor (AWS · GCP · Azure)

[![Ko-fi](https://img.shields.io/badge/Support-Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/zaicone)

Chrome extension to monitor the status of **all AWS, GCP, and Azure regions** in real time, organized by continent. Free and open source.

> If CloudRadar saves you time, consider [buying me a coffee ☕](https://ko-fi.com/zaicone) — it keeps the project alive!

---

## ☁️ Supported providers

| Provider | Regions | Data source |
|---|---|---|
| **AWS** | 32 regions | [AWS Health Dashboard](https://status.aws.amazon.com) |
| **GCP** | 19 regions | [GCP Status Dashboard](https://status.cloud.google.com) |
| **Azure** | 21 regions | [Azure Status](https://azure.status.microsoft/en-us/status) |

**Total: 72 regions monitored**

## ✨ Features

- Real-time status from official AWS, GCP, and Azure dashboards
- Geographic grouping by continent
- Filter by provider (AWS / GCP / Azure / All)
- Status indicators: Operational / Incident / Outage / Maintenance
- Last 24h history bar per region
- Quick search and filters
- Pin favorite regions to the top
- Dark/light theme
- Configurable refresh intervals (1/5/15/30 min)
- Badge notification on icon when issues are detected
- Export summary to clipboard

## 🚀 Installation

1. Download and unzip the ZIP
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right corner)
4. Click "Load unpacked"
5. Select the `cloudradar` folder

## 📡 Data sources

- **AWS**: `https://status.aws.amazon.com/data.json`
- **GCP**: `https://status.cloud.google.com/incidents.json`
- **Azure**: `https://azure.status.microsoft/api/v2/status`

## ☕ Support

CloudRadar is free and will always be free. If it's useful to you, you can support development on [Ko-fi](https://ko-fi.com/zaicone). Thank you!

## 📄 License

MIT
