# Privacy Policy — CloudRadar

**Last updated: June 2026**

## Overview

CloudRadar is a Chrome extension that monitors the real-time status of AWS, GCP, and Azure cloud regions. This policy explains what data the extension accesses and how it is handled.

## Data collection

CloudRadar does **not** collect, store, transmit, or share any personal data. The extension does not have servers of its own and does not send any information about you or your usage to any third party.

## Data stored locally

The extension stores the following data **only on your device** using Chrome's local storage API:

- Your preferred theme (dark or light)
- Your pinned regions
- Your configured refresh interval
- Cached status data from the last fetch (to speed up popup load time)

This data never leaves your device.

## Network requests

The extension makes outbound requests exclusively to the following official public status APIs:

- `https://status.aws.amazon.com` — AWS Health Dashboard
- `https://health.aws.amazon.com` — AWS Health (fallback)
- `https://status.cloud.google.com` — Google Cloud Status
- `https://azure.status.microsoft` — Azure Status

These are public endpoints operated by Amazon, Google, and Microsoft respectively. No personal data is included in these requests.

## Third-party services

CloudRadar does not use analytics, advertising, tracking, or any other third-party services.

## Changes to this policy

If this policy changes, the updated version will be published at this URL.

## Contact

For questions or concerns, open an issue at [github.com/zaicone01/cloudradar/issues](https://github.com/zaicone01/cloudradar/issues).
