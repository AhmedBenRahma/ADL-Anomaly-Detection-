<div align="center">

# CareWatch — ADL Anomaly Detection

### Watching over an elderly person who lives alone — using nothing but the home's electricity meter.

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-LSTM%20Autoencoder-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-TypeScript%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Dataset](https://img.shields.io/badge/Dataset-REFIT-2E8B57)](https://www.refitsmarthomes.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

</div>

**CareWatch learns an elderly resident's daily routine from their smart-meter data and flags the days that routine breaks** — a missed morning, an unusual night, an appliance that never came on. No cameras, no wearables, no sensors on the body: just the electricity signal the home already produces. It is a **non-invasive** early-warning tool for people who live alone, and the caregivers who worry about them.

A deep-learning autoencoder is trained on the resident's *normal* days and raises an alert on any day it cannot reconstruct — an **unsupervised** approach that needs no labelled examples of emergencies. The system ships as a **FastAPI** backend serving a **React + TypeScript** caregiver dashboard.

> Design & Development Project (PCD) — National School of Computer Science (ENSI), 2025–2026.

---

## Table of contents

- [The problem](#the-problem)
- [The idea](#the-idea-a-day-you-cant-reconstruct-is-a-day-worth-a-look)
- [Architecture](#architecture)
- [The model](#the-model)
- [Research findings](#research-findings)
- [The dashboard](#the-dashboard)
- [Setup](#setup)
- [Project structure](#project-structure)
- [Dataset](#dataset)
- [Limitations & future work](#limitations--future-work)
- [Team](#team)

---

## The problem

More and more elderly people live alone and wish to keep their independence — but a person living alone who has a fall, a stroke, or simply stops eating can go unnoticed for days. Cameras and wearables help, yet they are intrusive, easily forgotten, and often refused.

There is one signal every home already emits, continuously and privately: its **electricity consumption**. The kettle in the morning, the television in the evening, the washing machine on a Tuesday — a person's **Activities of Daily Living (ADL)** leave a distinctive fingerprint in the power trace. CareWatch asks: *can we watch over someone's wellbeing from that fingerprint alone?*

## The idea: a day you can't reconstruct is a day worth a look

We never try to define "an emergency" in advance — we couldn't enumerate them. Instead, an **autoencoder** is trained only on the resident's *normal* days; it learns to compress and rebuild a routine day almost perfectly. When a day arrives that doesn't fit the learned routine, the model **fails to reconstruct it**, the reconstruction error rises above a training-calibrated threshold, and the day is flagged.

```
normal days  ──train──▶  autoencoder learns the routine
new day       ──score──▶  reconstruction error  ──▶  above threshold?  ──▶  alert on the dashboard
```

## Architecture

![CareWatch architecture: REFIT house CSVs and a trained LSTM autoencoder feed a FastAPI backend (DataService precomputes and caches day scores at startup; ScoringService resamples, gap-fills, scales and runs sliding-window reconstruction MSE; ModelService loads the model and threshold; REST routers expose houses, anomalies, day detail, stats and comparison) which serves a React dashboard](images/architecture.png)

At startup the backend **precomputes and caches** an anomaly score for every day of every house, so the dashboard is instant. The scoring pipeline resamples each day to 1-minute resolution, fills short gaps, robust-scales the signal, and slides a 30-minute window (stride 15) through the autoencoder; the **day score is the worst window's reconstruction error**, and a day is anomalous when it exceeds the training 90th-percentile threshold.

## The model

The deployed detector is an **LSTM Autoencoder** (PyTorch): a 2-layer LSTM encoder (hidden size 64) compresses each window and a matching decoder rebuilds it, trained to minimise reconstruction error on normal days.

The **study behind CareWatch** (see the notebooks and the report) went further and compared **three** autoencoder architectures head to head:

| Model | Idea |
|---|---|
| **TCN Autoencoder** | Dilated causal convolutions over the day — the most sensitive detector. |
| **LSTM Autoencoder** *(deployed)* | Recurrent encoder–decoder with a per-timestep temporal bottleneck. |
| **Transformer Autoencoder** | Patch-based tokenisation + attention — the most conservative. |

> An honest engineering note from the study: the LSTM's first design used a *global* bottleneck (a whole 1440-minute day squeezed into one vector). It collapsed to a fixed attractor — identical reconstructions, **zero** anomalies detected. Switching to a **per-timestep temporal bottleneck** restored it. That debugging story is written up in the report.

## Research findings

The REFIT dataset has **no ground-truth labels** for behavioural anomalies, so precision/recall don't apply. The study evaluates honestly instead — flagged days and dates, percentile severity, **model-agreement** (a day flagged by all three models is high-confidence), and reconstruction plots with ADL typing.

![Two panels. Left: models trained on the resident's own history keep flag rates near the ~1% expected for a healthy person, while models trained on other homes over-detect wildly (59%, 43%, 9%). Right: on cross-house data, 10-channel models flag far more days than 1-channel models — most cross-house flags are appliance channel-index artefacts.](images/results.png)

- **You must train on the person, not on "people in general."** Trained on the resident's own history, the models behave (≈1–2% of days flagged, as expected for a healthy person). Trained on *other* houses and tested on an unseen one, they over-detect wildly (59% / 43% / 9% of days), because every home's "normal" is different. **ADL anomaly detection is inherently personalised.**
- **Appliance sub-metering earns its keep — twice.** Individual appliance channels don't only make an alert *interpretable* (which appliance → which activity); they actively **boost detection sensitivity** over an aggregate-only meter.
- **Consensus is the strongest signal.** On the per-house evaluation, the day **2015-07-03** was flagged by **all three models at once** — the highest-confidence detection — and the anomaly-typing module attributed it to unusual **Dishwasher and Television** usage.

## The dashboard

A **FastAPI** backend serves a **React + TypeScript (Vite + Tailwind)** dashboard for caregivers:

| Page | What it shows |
|---|---|
| **Overview** | Monitoring status and anomaly summary across all houses. |
| **Alerts / History** | Filterable table of flagged days with severity and trends over time. |
| **Day Detail** | Actual vs. reconstructed signal for a chosen day, hour-by-hour error. |
| **Statistics** | Distributions and weekday/season patterns. |
| **Comparison** | Behaviour compared across houses. |

REST API: `/houses`, `/houses/{id}/summary`, `/houses/{id}/anomalies`, `/houses/{id}/day/{date}`, `/houses/{id}/stats`, `/comparison` (interactive docs at `/docs`).

## Setup

**Prerequisites:** Python 3.10+, Node.js 18+.

```bash
# 1. Backend
cd Dashboard/backend
pip install -r requirements.txt
python -m uvicorn main:app --reload      # http://127.0.0.1:8000  (docs at /docs)

# 2. Frontend (new terminal)
cd Dashboard/frontend
npm install
npm run dev                              # http://localhost:5173

# or, with Docker:
docker-compose up
```

Place the REFIT CSVs in `Dashboard/backend/data/` and the trained model + scaler in `Dashboard/backend/model/` (both excluded from Git by size — see below). The backend scores every day once at startup, so the first launch takes a little while.

## Project structure

```
├── Dashboard/
│   ├── backend/            # FastAPI: routers (houses, anomalies, days, stats),
│   │   └── services/       # data / model / scoring services + LSTM architecture
│   └── frontend/           # React + TS + Vite + Tailwind dashboard (Recharts)
├── notebooks/
│   ├── LSTM_train*.ipynb   # training the LSTM autoencoder
│   ├── LSTM_Validation.ipynb
│   ├── LSTM_Injection_Suite.ipynb
│   ├── Transformers.ipynb  # the Transformer autoencoder study
│   └── preprocessing_House10_REFIT.ipynb
├── images/                 # architecture + research figures
├── report/                 # full PCD report (PDF)
└── README.md
```

## Dataset

**REFIT** — a two-year smart-meter study of 20 UK households (<https://www.refitsmarthomes.org/>). The raw CSVs and the trained `.pth`/scaler are **not committed** (too large); download REFIT and drop the files in the paths above, or retrain from the notebooks.

## Limitations & future work

- **No ground-truth anomaly labels** — evaluation is unsupervised; a clinical validation with logged real events is the next step.
- **Personalised by design** — a model must be trained on each resident's own history; cross-house transfer needs domain adaptation.
- **Single-occupant assumption** — the routine signal is cleanest for one person living alone.
- **Replay-based** — the dashboard scores historical REFIT data; a live smart-meter integration is the deployment step.

## Team

**Emna Abidi · Ahmed Ben Rahma** — Software Engineering students, ENSI.
Supervised by **Dr. Chiraz Houaidia** (ENSI, University of Manouba).

A Design & Development Project (PCD) toward the National Engineering Diploma. MIT License.
