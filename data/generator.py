"""Synthetic BDC data generator for BDC Agent Coaching Demo.

Generates 16 entities with BDC-realistic patterns.
Output: data/output/*.parquet and data/output/*.csv

Usage:
    cd <project-root>
    uv run --project data python data/generator.py
"""

import json
import os
from datetime import date, datetime, timedelta

import numpy as np
import pandas as pd

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
rng = np.random.default_rng(SEED)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

START_DATE = date(2024, 1, 1)
END_DATE   = date(2024, 1, 30)
N_DAYS     = (END_DATE - START_DATE).days + 1  # 30


def save(df: pd.DataFrame, name: str) -> None:
    out = df.copy()
    out.columns = [c.upper() for c in out.columns]
    out.to_parquet(os.path.join(OUTPUT_DIR, f"{name}.parquet"), index=False)
    out.to_csv(os.path.join(OUTPUT_DIR, f"{name}.csv"), index=False)
    print(f"  {name:<30s}: {len(out):>6,} rows")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. DEALERS  (5 Florida dealerships)
# ═══════════════════════════════════════════════════════════════════════════════
DEALER_DATA = [
    ("DLR001", "Sunshine Toyota",      "Toyota",    "Tampa",           "FL", "33601"),
    ("DLR002", "Bay Area Honda",       "Honda",     "St. Petersburg",  "FL", "33701"),
    ("DLR003", "Lakeland Ford",        "Ford",       "Lakeland",        "FL", "33801"),
    ("DLR004", "Gulf Coast Chevrolet", "Chevrolet", "Sarasota",        "FL", "34230"),
    ("DLR005", "Coastal BMW",          "BMW",        "Naples",          "FL", "34101"),
]


def gen_dealers() -> pd.DataFrame:
    rows = []
    for dealer_id, name, brand, city, state, zip_code in DEALER_DATA:
        rows.append({
            "dealer_id":   dealer_id,
            "dealer_name": name,
            "brand":       brand,
            "city":        city,
            "state":       state,
            "zip_code":    zip_code,
            "phone":       f"({int(rng.integers(200, 999))}) {int(rng.integers(200, 999))}-{int(rng.integers(1000, 9999))}",
            "created_at":  datetime(2020, 1, 1),
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 2. AGENTS  (30 total, 6 per dealer, 20% top / 50% mid / 30% bottom)
# ═══════════════════════════════════════════════════════════════════════════════
FIRST_NAMES = [
    "James", "Maria", "David", "Ashley", "Robert", "Jennifer",
    "Michael", "Jessica", "William", "Melissa", "Carlos", "Stephanie",
    "Luis", "Nicole", "Kevin", "Amanda", "Brian", "Rachel",
    "Jason", "Heather", "Eric", "Lauren", "Daniel", "Brittany",
    "Anthony", "Amber", "Mark", "Danielle", "Steven", "Crystal",
]
LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia",
    "Miller", "Davis", "Martinez", "Hernandez", "Lopez", "Gonzalez",
    "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson",
    "Martin", "Lee", "Perez", "Thompson", "White", "Harris",
    "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
]
SKILL_TIERS = ["top", "mid", "bottom"]
TIER_DIST   = [0.20, 0.50, 0.30]


def gen_agents(dealers: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for dealer_idx, (_, dealer) in enumerate(dealers.iterrows()):
        for i in range(6):
            global_idx = dealer_idx * 6 + i  # 0–29, unique per agent
            tier = str(rng.choice(SKILL_TIERS, p=TIER_DIST))
            fn   = FIRST_NAMES[global_idx]
            ln   = LAST_NAMES[global_idx]
            slug = dealer["dealer_name"].lower().replace(" ", "")
            rows.append({
                "agent_id":   f"AGT{global_idx + 1:03d}",
                "dealer_id":  dealer["dealer_id"],
                "first_name": fn,
                "last_name":  ln,
                "email":      f"{fn.lower()}.{ln.lower()}@{slug}.com",
                "phone":      f"({int(rng.integers(200, 999))}) {int(rng.integers(200, 999))}-{int(rng.integers(1000, 9999))}",
                "skill_tier": tier,
                "hire_date":  START_DATE - timedelta(days=int(rng.integers(90, 1801))),
                "is_active":  True,
                "created_at": datetime(2021, 1, 1),
            })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. CUSTOMERS  (2,000 — Florida cities, real-looking contact info)
# ═══════════════════════════════════════════════════════════════════════════════
FL_CITIES = [
    "Tampa", "St. Petersburg", "Orlando", "Jacksonville", "Miami",
    "Fort Lauderdale", "Clearwater", "Sarasota", "Lakeland", "Gainesville",
    "Tallahassee", "Pensacola", "Cape Coral", "Fort Myers", "Naples",
    "Bonita Springs", "Bradenton", "Ocala", "Daytona Beach", "Melbourne",
]
FL_AREA_CODES = [239, 305, 321, 352, 386, 407, 561, 727, 754, 772, 813, 850, 863, 904, 941, 954]


def gen_customers(n: int = 2000) -> pd.DataFrame:
    rows = []
    for i in range(n):
        fn   = FIRST_NAMES[i % len(FIRST_NAMES)]
        ln   = LAST_NAMES[(i * 3 + 7) % len(LAST_NAMES)]
        city = FL_CITIES[i % len(FL_CITIES)]
        area = int(rng.choice(FL_AREA_CODES))
        rows.append({
            "customer_id":  f"CUS{i + 1:05d}",
            "first_name":   fn,
            "last_name":    ln,
            "email":        f"{fn.lower()}.{ln.lower()}{i}@gmail.com",
            "phone":        f"({area}) {int(rng.integers(200, 999))}-{int(rng.integers(1000, 9999))}",
            "city":         city,
            "state":        "FL",
            "zip_code":     f"{int(rng.integers(32000, 34999))}",
            "opt_in_sms":   bool(rng.random() < 0.70),
            "opt_in_email": bool(rng.random() < 0.85),
            "do_not_call":  bool(rng.random() < 0.02),
            "created_at":   START_DATE - timedelta(days=int(rng.integers(30, 1501))),
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. VEHICLES  (2,500 — brand-matched + trade-ins; 25% leases)
# ═══════════════════════════════════════════════════════════════════════════════
BRAND_MODELS: dict[str, list[tuple[str, list[int]]]] = {
    "Toyota":    [
        ("Camry",      [2019, 2020, 2021, 2022, 2023]),
        ("Corolla",    [2018, 2019, 2020, 2021, 2022]),
        ("RAV4",       [2020, 2021, 2022, 2023]),
        ("Tacoma",     [2019, 2020, 2021, 2022]),
        ("Highlander", [2020, 2021, 2022]),
    ],
    "Honda":     [
        ("Accord",  [2019, 2020, 2021, 2022, 2023]),
        ("Civic",   [2018, 2019, 2020, 2021, 2022]),
        ("CR-V",    [2019, 2020, 2021, 2022]),
        ("Pilot",   [2020, 2021, 2022]),
        ("Odyssey", [2019, 2020, 2021]),
    ],
    "Ford":      [
        ("F-150",    [2018, 2019, 2020, 2021, 2022]),
        ("Explorer", [2019, 2020, 2021, 2022]),
        ("Escape",   [2019, 2020, 2021, 2022]),
        ("Edge",     [2019, 2020, 2021]),
        ("Bronco",   [2021, 2022, 2023]),
    ],
    "Chevrolet": [
        ("Silverado", [2018, 2019, 2020, 2021, 2022]),
        ("Equinox",   [2019, 2020, 2021, 2022]),
        ("Malibu",    [2018, 2019, 2020, 2021]),
        ("Traverse",  [2019, 2020, 2021, 2022]),
        ("Colorado",  [2019, 2020, 2021]),
    ],
    "BMW":       [
        ("3 Series", [2019, 2020, 2021, 2022]),
        ("5 Series", [2019, 2020, 2021, 2022]),
        ("X3",       [2019, 2020, 2021, 2022]),
        ("X5",       [2020, 2021, 2022]),
        ("7 Series", [2020, 2021, 2022]),
    ],
    # Trade-in brands
    "Nissan":    [("Altima", [2018, 2019, 2020]), ("Rogue", [2019, 2020, 2021])],
    "Hyundai":   [("Sonata", [2018, 2019, 2020]), ("Tucson", [2019, 2020, 2021])],
    "Kia":       [("Sorento", [2018, 2019, 2020]), ("Optima", [2018, 2019])],
}
TRADE_IN_BRANDS = ["Nissan", "Hyundai", "Kia"]
COLORS = ["White", "Silver", "Black", "Gray", "Red", "Blue", "Green", "Brown", "Gold", "Beige"]
TRIMS  = ["LE", "SE", "XLE", "Limited", "Sport", "Base", "EX", "LX", ""]


def _random_vehicle(vid: int, cust_id: str, dealer_id: str, dealer_brand: str) -> dict:
    brand = dealer_brand
    if rng.random() < 0.15:
        brand = str(rng.choice(TRADE_IN_BRANDS))
    models     = BRAND_MODELS.get(brand, BRAND_MODELS["Toyota"])
    model_name, years = models[int(rng.integers(0, len(models)))]
    year       = int(rng.choice(years))
    is_lease   = bool(rng.random() < 0.25)
    lease_end  = (START_DATE + timedelta(days=int(rng.integers(-90, 181)))) if is_lease else None
    vin_suffix = "".join(str(int(rng.integers(0, 10))) for _ in range(16))
    return {
        "vehicle_id":    f"VEH{vid:05d}",
        "customer_id":   cust_id,
        "dealer_id":     dealer_id,
        "vin":           f"1{vin_suffix}",
        "year":          year,
        "make":          brand,
        "model":         model_name,
        "trim":          str(rng.choice(TRIMS)),
        "color":         str(rng.choice(COLORS)),
        "mileage":       int(rng.integers(5000, 120001)),
        "purchase_date": START_DATE - timedelta(days=int(rng.integers(30, 1801))),
        "is_lease":      is_lease,
        "lease_end_date": lease_end,
        "created_at":    START_DATE - timedelta(days=int(rng.integers(30, 1501))),
    }


def gen_vehicles(customers: pd.DataFrame, dealers: pd.DataFrame) -> pd.DataFrame:
    dealer_ids    = dealers["dealer_id"].tolist()
    dealer_brands = dict(zip(dealers["dealer_id"], dealers["brand"]))
    cust_ids      = customers["customer_id"].tolist()

    # 2000 customers each get 1 vehicle; 500 randomly chosen get a second → 2500 total
    extra_idx  = rng.choice(len(cust_ids), size=500, replace=True)
    assignments = list(cust_ids) + [cust_ids[i] for i in extra_idx]

    rows = []
    for vid, cust_id in enumerate(assignments, start=1):
        dealer_id    = str(rng.choice(dealer_ids))
        dealer_brand = dealer_brands[dealer_id]
        rows.append(_random_vehicle(vid, cust_id, dealer_id, dealer_brand))
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. SERVICE HISTORY  (10,000 records)
# ═══════════════════════════════════════════════════════════════════════════════
SERVICE_TYPES = [
    "Oil Change", "Tire Rotation", "Brake Inspection", "Multi-Point Inspection",
    "Air Filter Replacement", "Cabin Filter Replacement", "Transmission Service",
    "Coolant Flush", "Battery Replacement", "Wiper Blade Replacement",
    "Wheel Alignment", "Fuel System Service", "Recall Repair", "Warranty Repair",
    "Tire Purchase", "Brake Pad Replacement",
]


def gen_service_history(vehicles: pd.DataFrame, n: int = 10000) -> pd.DataFrame:
    veh_ids    = vehicles["vehicle_id"].tolist()
    dealer_map = dict(zip(vehicles["vehicle_id"], vehicles["dealer_id"]))
    rows = []
    for i in range(n):
        veh_id   = str(rng.choice(veh_ids))
        svc_date = START_DATE - timedelta(days=int(rng.integers(0, 731)))
        labor    = round(float(rng.uniform(29.0, 450.0)), 2)
        parts    = round(float(rng.uniform(0.0, 300.0)), 2) if rng.random() < 0.6 else 0.0
        rows.append({
            "service_id":          f"SVC{i + 1:06d}",
            "vehicle_id":          veh_id,
            "dealer_id":           dealer_map.get(veh_id, "DLR001"),
            "service_date":        svc_date,
            "service_type":        str(rng.choice(SERVICE_TYPES)),
            "mileage_at_service":  int(rng.integers(5000, 120001)),
            "labor_cost":          labor,
            "parts_cost":          parts,
            "total_cost":          round(labor + parts, 2),
            "advisor_name":        f"{FIRST_NAMES[i % len(FIRST_NAMES)]} {LAST_NAMES[(i * 2) % len(LAST_NAMES)]}",
            "ro_number":           f"RO{i + 1:07d}",
            "csi_score":           int(rng.integers(1, 11)) if rng.random() < 0.6 else None,
            "created_at":          svc_date,
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 6. CAMPAIGNS  (25 — 5 per dealer)
# ═══════════════════════════════════════════════════════════════════════════════
CAMPAIGN_TYPES = ["service_recall", "lease_maturity", "csi_survey", "conquest", "retention"]


def gen_campaigns(dealers: pd.DataFrame) -> pd.DataFrame:
    rows = []
    cid = 1
    for _, dealer in dealers.iterrows():
        for camp_type in CAMPAIGN_TYPES:
            start = START_DATE - timedelta(days=int(rng.integers(0, 16)))
            rows.append({
                "campaign_id":   f"CMP{cid:03d}",
                "dealer_id":     dealer["dealer_id"],
                "campaign_name": f"{dealer['brand']} {camp_type.replace('_', ' ').title()} - Jan 2024",
                "campaign_type": camp_type,
                "start_date":    start,
                "end_date":      start + timedelta(days=30),
                "target_count":  int(rng.integers(50, 301)),
                "is_active":     True,
                "created_at":    start - timedelta(days=5),
            })
            cid += 1
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 7. CALLS  (15,000 over 30 days — time-of-day curve + tier-correlated disposition)
# ═══════════════════════════════════════════════════════════════════════════════
DISPOSITIONS = [
    "appointment_set", "voicemail", "no_answer", "callback_requested",
    "information_provided", "complaint", "wrong_number", "do_not_call",
]
DISP_PROBS = np.array([0.30, 0.25, 0.15, 0.10, 0.10, 0.05, 0.03, 0.02])

# Hour → weight (peaks 9–11 AM and 2–4 PM)
_HOUR_WEIGHTS = {7: 0.02, 8: 0.05, 9: 0.12, 10: 0.14, 11: 0.12,
                 12: 0.05, 13: 0.06, 14: 0.12, 15: 0.13, 16: 0.10,
                 17: 0.05, 18: 0.03, 19: 0.01}
HOURS    = np.array(list(_HOUR_WEIGHTS.keys()))
HOUR_P   = np.array(list(_HOUR_WEIGHTS.values()), dtype=float)
HOUR_P  /= HOUR_P.sum()

TIER_DURATION   = {"top": (180, 360), "mid": (120, 240), "bottom": (60, 150)}
TIER_CONVERSION = {"top": (0.40, 0.50), "mid": (0.25, 0.35), "bottom": (0.10, 0.20)}


def gen_calls(
    agents: pd.DataFrame,
    customers: pd.DataFrame,
    campaigns: pd.DataFrame,
    n: int = 15000,
) -> pd.DataFrame:
    agent_records  = agents.to_dict("records")
    cust_ids       = customers["customer_id"].tolist()
    camp_ids       = campaigns["campaign_id"].tolist()
    camp_dealer    = dict(zip(campaigns["campaign_id"], campaigns["dealer_id"]))

    # Pre-index agents by dealer
    agents_by_dealer: dict[str, list] = {}
    for a in agent_records:
        agents_by_dealer.setdefault(a["dealer_id"], []).append(a)

    rows = []
    for i in range(n):
        call_date = START_DATE + timedelta(days=int(rng.integers(0, N_DAYS)))
        hour      = int(rng.choice(HOURS, p=HOUR_P))
        call_dt   = datetime(
            call_date.year, call_date.month, call_date.day,
            hour, int(rng.integers(0, 60)), int(rng.integers(0, 60)),
        )
        camp_id   = str(rng.choice(camp_ids))
        dealer_id = camp_dealer[camp_id]
        pool      = agents_by_dealer.get(dealer_id, agent_records)
        agent     = pool[int(rng.integers(0, len(pool)))]
        tier      = agent["skill_tier"]
        duration  = int(rng.integers(*TIER_DURATION[tier]))

        # Adjust appointment_set probability by tier
        conv_lo, conv_hi = TIER_CONVERSION[tier]
        conv_rate  = float(rng.uniform(conv_lo, conv_hi))
        other_sum  = float(DISP_PROBS[1:].sum())  # 0.70
        adj        = DISP_PROBS.copy().astype(float)
        adj[0]     = conv_rate
        adj[1:]    = DISP_PROBS[1:] / other_sum * (1.0 - conv_rate)

        disposition = str(rng.choice(DISPOSITIONS, p=adj))
        rows.append({
            "call_id":        f"CALL{i + 1:06d}",
            "dealer_id":      dealer_id,
            "agent_id":       agent["agent_id"],
            "customer_id":    str(rng.choice(cust_ids)),
            "campaign_id":    camp_id,
            "call_datetime":  call_dt,
            "call_date":      call_date,
            "duration_seconds": duration,
            "disposition":    disposition,
            "direction":      "outbound",
            "call_type":      str(rng.choice(["live_connect", "voicemail", "no_answer"],
                                             p=[0.60, 0.25, 0.15])),
            "recording_url":  (
                f"s3://bdc-recordings/{dealer_id}/"
                f"{call_dt.strftime('%Y/%m/%d')}/CALL{i + 1:06d}.mp3"
            ),
            "created_at":     call_dt,
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 8. CALL TRANSCRIPTS  (12 scenario templates, 2–3 variants each)
# ═══════════════════════════════════════════════════════════════════════════════
# Each template: turns = list of variants, each variant = list of (speaker, text, offset)
SCENARIO_TEMPLATES: dict[str, dict] = {
    "appt_successful": {
        "turns": [
            [
                ("Agent",    "Hello, may I speak with {customer_name}?", 0),
                ("Customer", "This is {customer_name}.", 4),
                ("Agent",    "Hi {customer_name}, this is {agent_name} calling from {dealer_name}. I see your {year} {make} {model} is due for its {service_type}. I wanted to reach out and help you get that scheduled. Do you have a few minutes?", 6),
                ("Customer", "Sure, yeah, I've been meaning to bring it in.", 18),
                ("Agent",    "Great! We have availability on {appt_date} — does morning or afternoon work better for you?", 22),
                ("Customer", "Morning would be perfect, maybe around 9 or 10.", 30),
                ("Agent",    "I can get you in at 9:30 AM. We'll include a complimentary multi-point inspection as well. Does that work?", 36),
                ("Customer", "Yes, that sounds good.", 46),
                ("Agent",    "Wonderful. I have you down for {appt_date} at 9:30 AM at {dealer_name}. You'll receive a confirmation text shortly. Is there anything else I can help you with?", 50),
                ("Customer", "No, that's all. Thank you.", 63),
                ("Agent",    "Thank you, {customer_name}. We look forward to seeing you. Have a great day!", 67),
            ],
            [
                ("Agent",    "Good morning, is {customer_name} available?", 0),
                ("Customer", "Speaking.", 3),
                ("Agent",    "Hi {customer_name}, this is {agent_name} from {dealer_name}'s service team. Your {year} {make} is showing it's time for a {service_type}. We'd love to get that taken care of for you.", 5),
                ("Customer", "Oh right, I've been putting that off.", 17),
                ("Agent",    "No worries at all! We have some great openings this week. Would {appt_date} work for you?", 21),
                ("Customer", "That works for me.", 28),
                ("Agent",    "Perfect. I'll put you down for {appt_date} at 10:00 AM. You'll get a reminder the day before. Anything else I can help with today?", 32),
                ("Customer", "Nope, that's it. Thanks!", 45),
                ("Agent",    "Thank you, {customer_name}! See you then. Take care!", 49),
            ],
            [
                ("Agent",    "Hi there, this is {agent_name} calling from {dealer_name}. May I speak with {customer_name}?", 0),
                ("Customer", "Yeah, that's me.", 6),
                ("Agent",    "Hi {customer_name}! I'm reaching out because your {year} {make} {model} is coming up on its {service_type} interval. We want to make sure your vehicle stays protected. Can I grab you a spot this week?", 9),
                ("Customer", "Sure, what's available on {appt_date}?", 22),
                ("Agent",    "We have 9 AM, 11 AM, or 2 PM on {appt_date}. Which works best?", 27),
                ("Customer", "11 AM is perfect.", 33),
                ("Agent",    "Great, I've got you down for 11 AM on {appt_date}. Plan for about 45 minutes. We'll send a text confirmation. Anything else?", 36),
                ("Customer", "That's all, thank you!", 49),
                ("Agent",    "Wonderful! See you on {appt_date}, {customer_name}!", 52),
            ],
        ],
        "summary":          "Agent successfully scheduled a {service_type} appointment for {customer_name}'s {year} {make} {model} on {appt_date}.",
        "disposition_class": "service_appointment",
        "follow_up":         "Send appointment confirmation text and reminder 24 hours before.",
    },

    "appt_declined": {
        "turns": [
            [
                ("Agent",    "Hi, may I speak with {customer_name}?", 0),
                ("Customer", "Yeah, that's me.", 3),
                ("Agent",    "Hi {customer_name}, this is {agent_name} calling from {dealer_name}. I'm reaching out because your {year} {make} is due for a {service_type}. I wanted to help you get that on the calendar.", 5),
                ("Customer", "I appreciate the call but I'm pretty busy this month. Can you call back later?", 16),
                ("Agent",    "Absolutely, I completely understand. When would be a better time — maybe next week or the week after?", 23),
                ("Customer", "Try me in about two weeks.", 30),
                ("Agent",    "Will do! I'll put a note to follow up in two weeks. Is this still the best number to reach you?", 34),
                ("Customer", "Yes, this is fine.", 41),
                ("Agent",    "Perfect. Thank you for your time, {customer_name}, and we'll be in touch. Have a great day!", 44),
            ],
            [
                ("Agent",    "Hello, this is {agent_name} from {dealer_name}. May I speak with {customer_name}?", 0),
                ("Customer", "This is her. What's this about?", 5),
                ("Agent",    "Hi there! I'm calling because your {year} {make} {model} is due for its {service_type} and I wanted to help you schedule an appointment.", 9),
                ("Customer", "I actually just had that done somewhere else last month.", 20),
                ("Agent",    "Oh, that's great that you took care of it! No problem at all. We'd still love to have you as a service customer in the future. Would it be okay if we stayed in touch?", 25),
                ("Customer", "Sure, that's fine.", 36),
                ("Agent",    "Wonderful. I'll make a note here. Thanks for your time and have a wonderful day!", 40),
            ],
        ],
        "summary":          "Customer {customer_name} declined to schedule at this time and requested a callback in two weeks.",
        "disposition_class": "callback_request",
        "follow_up":         "Schedule follow-up call in two weeks.",
    },

    "recall_notification": {
        "turns": [
            [
                ("Agent",    "Hello, may I speak with {customer_name}?", 0),
                ("Customer", "Speaking.", 3),
                ("Agent",    "Hi {customer_name}, this is {agent_name} calling from {dealer_name}. I'm calling with important information regarding your {year} {make} {model}. There is an open safety recall and the repair is completely free of charge. Do you have a moment?", 5),
                ("Customer", "A recall? What is it for?", 19),
                ("Agent",    "Yes, NHTSA has issued a recall for the {recall_component} on certain {year} {make} vehicles. Our dealership has the parts in stock and we can take care of it at no cost to you. I'd like to get you scheduled.", 24),
                ("Customer", "Okay, that sounds important. When can I bring it in?", 38),
                ("Agent",    "We have openings as early as {appt_date}. Would that work for you?", 43),
                ("Customer", "Yes, morning if possible.", 48),
                ("Agent",    "I have you down for {appt_date} at 8:30 AM. This typically takes about an hour. We can also provide a loaner if needed. Does that sound good?", 52),
                ("Customer", "Perfect, yes.", 65),
                ("Agent",    "Great! You'll receive a confirmation with all the details. Thank you for your time, {customer_name}, and we look forward to taking care of your vehicle!", 68),
            ],
            [
                ("Agent",    "Hi {customer_name}, this is {agent_name} with {dealer_name}. I'm calling about an important safety recall on your {year} {make} {model}. This repair is 100% free — do you have a minute?", 0),
                ("Customer", "Sure, go ahead.", 14),
                ("Agent",    "NHTSA has issued Recall # for the {recall_component}. We have parts on hand right now. Can I schedule you for {appt_date}?", 17),
                ("Customer", "Yeah, let's do it.", 28),
                ("Agent",    "Perfect, {appt_date} at 9 AM. We'll send a confirmation text. Thank you, {customer_name}!", 31),
            ],
        ],
        "summary":          "Agent notified {customer_name} of an open safety recall on their {year} {make} {model} and scheduled a free recall repair on {appt_date}.",
        "disposition_class": "service_appointment",
        "follow_up":         "Send recall appointment confirmation and NHTSA recall details by email.",
    },

    "oil_change_reminder": {
        "turns": [
            [
                ("Agent",    "Hi there, may I speak with {customer_name}?", 0),
                ("Customer", "This is {customer_name}.", 4),
                ("Agent",    "Hi {customer_name}! This is {agent_name} at {dealer_name}. We noticed it's been a while since your last oil change on your {year} {make} {model} — you're coming up on the recommended interval. I wanted to reach out and help you get that scheduled.", 6),
                ("Customer", "Oh wow, has it been that long already?", 19),
                ("Agent",    "It has! We want to make sure your engine stays protected. We include a complimentary multi-point inspection with every oil change. Can I grab you a spot this week?", 23),
                ("Customer", "Sure, what do you have on {appt_date}?", 35),
                ("Agent",    "We have 9 AM, 11 AM, or 2 PM. Which works best for you?", 40),
                ("Customer", "11 AM works.", 46),
                ("Agent",    "Perfect, I'll get you in at 11 AM on {appt_date}. Plan for about 45 minutes. Anything else I can help with?", 49),
                ("Customer", "No, that's good. Thanks!", 60),
                ("Agent",    "Wonderful! See you then, {customer_name}. Have a great day!", 63),
            ],
            [
                ("Agent",    "Good afternoon, is this {customer_name}?", 0),
                ("Customer", "Yes.", 3),
                ("Agent",    "Hi {customer_name}, it's {agent_name} from {dealer_name}. Your {year} {make} is due for an oil change and I wanted to make it easy for you to get that done. We have express service available or I can book you a specific time. What do you prefer?", 5),
                ("Customer", "A specific time is better for me.", 19),
                ("Agent",    "Of course! We have availability on {appt_date}. Would that work?", 22),
                ("Customer", "Yeah, morning would be good.", 28),
                ("Agent",    "I'll put you down for 9:30 AM on {appt_date}. You'll get a text reminder the day before. Thanks for choosing {dealer_name}!", 32),
                ("Customer", "Great, appreciate it!", 43),
                ("Agent",    "Absolutely, {customer_name}! See you then!", 46),
            ],
        ],
        "summary":          "Agent reminded {customer_name} about their overdue oil change for their {year} {make} {model} and scheduled service on {appt_date}.",
        "disposition_class": "service_appointment",
        "follow_up":         "Send service appointment confirmation text.",
    },

    "lease_maturity": {
        "turns": [
            [
                ("Agent",    "Hello, may I speak with {customer_name}?", 0),
                ("Customer", "This is {customer_name}.", 4),
                ("Agent",    "Hi {customer_name}, this is {agent_name} calling from {dealer_name}. I'm reaching out because your {year} {make} lease is coming up for maturity in the next few months and I wanted to make sure you have all the information you need about your options.", 6),
                ("Customer", "Oh, it's coming up that soon?", 19),
                ("Agent",    "It is! You have a few great options — you can return the vehicle, purchase it at the residual price, or we can explore a new lease with the latest models. Our team would love to walk you through what makes the most sense for you. Would you like to come in for a consultation?", 23),
                ("Customer", "I'm interested in possibly getting a new model. What are the current incentives?", 40),
                ("Agent",    "We have some excellent deals right now on the new {make} lineup. I'd love to connect you with one of our sales consultants who can walk you through the full picture. Can I schedule a time for you to come in on {appt_date}?", 51),
                ("Customer", "Sure, that works.", 66),
                ("Agent",    "Excellent! I'll get that set up for {appt_date}. You'll receive a confirmation with the details. We look forward to seeing you!", 69),
            ],
            [
                ("Agent",    "Hi {customer_name}, it's {agent_name} from {dealer_name}. Quick question — are you aware your {year} {make} lease is maturing soon?", 0),
                ("Customer", "I think I saw something in the mail about that.", 12),
                ("Agent",    "Yes! You have three options: return it, buy it, or get into a new model. We're running some great lease specials right now. When can you come in to chat? How about {appt_date}?", 17),
                ("Customer", "That could work. Let's do it.", 30),
                ("Agent",    "Fantastic! I'll book you for {appt_date}. Our sales team will have everything ready for you. See you then, {customer_name}!", 34),
            ],
        ],
        "summary":          "Agent discussed lease maturity options with {customer_name} regarding their {year} {make} and scheduled a sales consultation on {appt_date}.",
        "disposition_class": "sales_appointment",
        "follow_up":         "Schedule sales consultation and send lease maturity guide via email.",
    },

    "csi_survey": {
        "turns": [
            [
                ("Agent",    "Hi, may I please speak with {customer_name}?", 0),
                ("Customer", "Speaking.", 3),
                ("Agent",    "Hi {customer_name}, this is {agent_name} from {dealer_name}. I'm following up on your recent service visit to make sure everything went smoothly. Do you have about two minutes?", 5),
                ("Customer", "Sure.", 14),
                ("Agent",    "Great! On a scale of 1 to 10, how would you rate your overall experience with our service department?", 16),
                ("Customer", "I'd say about an 8.", 24),
                ("Agent",    "Thank you! We're glad you had a positive experience. Is there anything we could have done better to earn a 10?", 27),
                ("Customer", "The wait time was a little longer than expected, but the work was done well.", 35),
                ("Agent",    "I really appreciate that feedback. We're always working to improve our wait times. I'll pass that along to our service manager. Is there anything else you'd like to share?", 48),
                ("Customer", "No, that's it.", 60),
                ("Agent",    "Perfect. Thank you so much for your time, {customer_name}. We value your business and hope to see you again soon. Have a great day!", 63),
            ],
            [
                ("Agent",    "Hello, is this {customer_name}?", 0),
                ("Customer", "Yes.", 3),
                ("Agent",    "Hi {customer_name}! I'm {agent_name} from {dealer_name}. We wanted to reach out after your recent service to get your feedback. How did everything go?", 5),
                ("Customer", "Everything was really good. The team was very helpful.", 16),
                ("Agent",    "That's wonderful to hear! We'll be sending you a brief survey via email. We'd really appreciate it if you could take a moment to complete it — it helps us maintain our high standards.", 21),
                ("Customer", "Sure, I'll look for that.", 33),
                ("Agent",    "Thank you so much! You have a great day, {customer_name}!", 36),
            ],
        ],
        "summary":          "Agent completed a CSI follow-up call with {customer_name} after their recent service visit. Customer gave positive feedback.",
        "disposition_class": "information_only",
        "follow_up":         "Send CSI survey email and note feedback in CRM.",
    },

    "parts_status": {
        "turns": [
            [
                ("Agent",    "Hello, may I speak with {customer_name}?", 0),
                ("Customer", "This is {customer_name}.", 4),
                ("Agent",    "Hi {customer_name}, this is {agent_name} calling from {dealer_name}. I'm calling with an update on your {year} {make} — the part has arrived and we're ready to get you scheduled.", 6),
                ("Customer", "Oh great! I've been waiting on that. How long will the install take?", 22),
                ("Agent",    "It should take about 2 hours. We can get you in as early as {appt_date}. Does that work?", 30),
                ("Customer", "Yes, that works perfectly.", 38),
                ("Agent",    "Great! I'll get you scheduled for {appt_date} at 10 AM. We'll have everything ready. Thank you for your patience, {customer_name}!", 41),
            ],
            [
                ("Agent",    "Hi {customer_name}, this is {agent_name} from {dealer_name}. I'm calling with an update — unfortunately the part for your {year} {make} has been back-ordered. We're expecting it in about a week.", 0),
                ("Customer", "Okay, I appreciate the update. Do you have a more specific date?", 18),
                ("Agent",    "Our parts team estimates it'll arrive by {appt_date}. We'll give you a call as soon as it's in to get you scheduled right away.", 24),
                ("Customer", "Okay, sounds good.", 34),
                ("Agent",    "Thank you for your patience, {customer_name}. We really appreciate it. Have a great day!", 37),
            ],
        ],
        "summary":          "Agent provided a parts availability status update to {customer_name} regarding their {year} {make} repair.",
        "disposition_class": "information_only",
        "follow_up":         "Schedule repair appointment upon parts arrival and send update notification.",
    },

    "advisor_connect_success": {
        "turns": [
            [
                ("Agent",    "Thank you for calling {dealer_name} service, this is {agent_name}. How can I help you today?", 0),
                ("Customer", "Hi, I need to speak with my service advisor about my car.", 8),
                ("Agent",    "Of course! May I have your name please?", 14),
                ("Customer", "It's {customer_name}.", 17),
                ("Agent",    "Thank you, {customer_name}. And which vehicle are you calling about?", 20),
                ("Customer", "My {year} {make} {model}.", 25),
                ("Agent",    "Perfect. Let me connect you to your service advisor right away. Please hold for just a moment.", 29),
                ("Customer", "Sure.", 39),
                ("Agent",    "I have your advisor on the line now. Thank you for calling {dealer_name}, {customer_name}!", 41),
            ],
        ],
        "summary":          "Agent successfully connected {customer_name} with their service advisor regarding their {year} {make} {model}.",
        "disposition_class": "information_only",
        "follow_up":         "No follow-up required — transferred to advisor.",
    },

    "advisor_connect_failed": {
        "turns": [
            [
                ("Agent",    "Thank you for calling {dealer_name} service, this is {agent_name}. How can I assist you?", 0),
                ("Customer", "I need to talk to my service advisor about my {year} {make}.", 8),
                ("Agent",    "I'd be happy to help connect you. Your advisor is currently with another customer, but I can have them call you back. May I have your name?", 15),
                ("Customer", "Yes, it's {customer_name}.", 28),
                ("Agent",    "Thank you, {customer_name}. And the best number to reach you?", 32),
                ("Customer", "You can reach me at my cell.", 38),
                ("Agent",    "Perfect. I'll let your advisor know you called and have them reach you shortly. Is there anything I can help you with in the meantime?", 42),
                ("Customer", "No, I'll wait for the callback.", 55),
                ("Agent",    "Wonderful. Thank you for your patience, {customer_name}. Have a great day!", 59),
            ],
        ],
        "summary":          "Agent took a callback message for {customer_name} as their service advisor was unavailable.",
        "disposition_class": "callback_request",
        "follow_up":         "Notify service advisor of callback request within 30 minutes.",
    },

    "complaint_wait_time": {
        "turns": [
            [
                ("Agent",    "Thank you for calling {dealer_name}, this is {agent_name}. How can I help you today?", 0),
                ("Customer", "Yes, I've been waiting here for over two hours for an oil change that was supposed to take 45 minutes. This is unacceptable.", 8),
                ("Agent",    "I'm so sorry to hear that, {customer_name}. I completely understand your frustration and I sincerely apologize for the wait. Let me pull up your information right away.", 22),
                ("Customer", "I have places to be. I was told it would be done by noon.", 35),
                ("Agent",    "You're absolutely right, and I apologize we haven't met that expectation. I'm going to escalate this to our service manager immediately and prioritize your vehicle. Can you give me just two minutes?", 43),
                ("Customer", "Fine, but I'm not happy about this.", 57),
                ("Agent",    "I understand completely and your frustration is warranted. Our service manager will be with you shortly and we'll make this right. Thank you for your patience, {customer_name}.", 61),
            ],
            [
                ("Agent",    "Thank you for calling {dealer_name}, this is {agent_name}.", 0),
                ("Customer", "I need to file a complaint about my service appointment. I waited an hour and a half past my appointment time.", 7),
                ("Agent",    "I am so sorry to hear this, {customer_name}. That is not the level of service we aim to provide. Can I get your RO number or the date of your visit?", 18),
                ("Customer", "I don't have the RO number but it was yesterday.", 32),
                ("Agent",    "No problem, I'll pull it up by name. I'm going to document this and have our service director reach out to you directly. We'd also like to offer you a complimentary oil change on your next visit.", 37),
                ("Customer", "I appreciate that. Yes.", 52),
                ("Agent",    "Thank you for giving us the opportunity to make this right. You'll hear from our service director within 24 hours. We value your business, {customer_name}.", 55),
            ],
        ],
        "summary":          "Agent handled a wait-time complaint from {customer_name}. Escalated to service manager and offered complimentary service credit.",
        "disposition_class": "complaint",
        "follow_up":         "Escalate to service manager. Send written apology with complimentary service credit within 24 hours.",
    },

    "appt_confirmation": {
        "turns": [
            [
                ("Agent",    "Hello, may I speak with {customer_name}?", 0),
                ("Customer", "This is {customer_name}.", 4),
                ("Agent",    "Hi {customer_name}! This is {agent_name} from {dealer_name}. I'm calling to confirm your service appointment scheduled for {appt_date} at 9:30 AM. Are you still able to make it?", 6),
                ("Customer", "Yes, I'll be there.", 18),
                ("Agent",    "Wonderful! Just a reminder — please bring your driver's license and we'll have your {year} {make} taken care of. Is there anything else you'd like to add to the visit?", 22),
                ("Customer", "Can you also check my tires while you have it?", 34),
                ("Agent",    "Absolutely! I'll add a complimentary tire inspection to your appointment. Is there anything else?", 40),
                ("Customer", "No, that's it. Thank you!", 47),
                ("Agent",    "Great! We'll see you on {appt_date}, {customer_name}. Have a wonderful day!", 51),
            ],
            [
                ("Agent",    "Hi {customer_name}, it's {agent_name} from {dealer_name}. Quick confirmation call — you're all set for {appt_date} for your {year} {make} service. Still good?", 0),
                ("Customer", "Yes, confirmed.", 13),
                ("Agent",    "Perfect! We'll see you then. Anything to add to the visit?", 16),
                ("Customer", "No, just the scheduled service.", 22),
                ("Agent",    "Got it. See you on {appt_date}! Have a great day!", 25),
            ],
        ],
        "summary":          "Agent confirmed {customer_name}'s upcoming service appointment on {appt_date} for their {year} {make} {model}.",
        "disposition_class": "information_only",
        "follow_up":         "Send appointment confirmation text with dealership address.",
    },

    "sales_inquiry": {
        "turns": [
            [
                ("Agent",    "Thank you for calling {dealer_name} service, this is {agent_name}. How can I help you?", 0),
                ("Customer", "Hi, I actually have a question about a new car. My {year} {make} is getting pretty old and I'm thinking about trading it in.", 8),
                ("Agent",    "Great question! You've come to the right place. While you're here for service, our sales team would love to show you what we have and give you a trade-in value on your current vehicle. Would you like me to connect you with a sales consultant?", 22),
                ("Customer", "Yes, I think that would be helpful.", 38),
                ("Agent",    "Perfect! I'm going to transfer you to our sales team — they'll answer all your questions about the latest {make} models and what kind of deal we can put together. One moment please!", 42),
                ("Customer", "Thank you!", 56),
                ("Agent",    "My pleasure, {customer_name}! Connecting you now.", 58),
            ],
            [
                ("Agent",    "Hi {customer_name}, this is {agent_name} from {dealer_name}. I see your {year} {make} {model} has been in for service a few times this year. I wanted to reach out because we have great deals on new models and your trade-in value might be higher than you'd expect.", 0),
                ("Customer", "Oh really? I have been thinking about upgrading.", 22),
                ("Agent",    "We'd love to have you in for a no-obligation consultation. Our sales team can show you the latest {make} models and run the numbers on your trade. Would you be interested in coming in on {appt_date}?", 27),
                ("Customer", "That sounds good actually.", 41),
                ("Agent",    "Excellent! I'll get you set up. You'll receive a confirmation shortly. We look forward to seeing you!", 44),
            ],
        ],
        "summary":          "Agent identified a sales opportunity from service customer {customer_name} and connected them with the sales team.",
        "disposition_class": "sales_appointment",
        "follow_up":         "Transfer to sales team and log opportunity in CRM.",
    },
}

SCENARIO_KEYS   = list(SCENARIO_TEMPLATES.keys())
RECALL_COMPONENTS = [
    "fuel pump relay", "airbag inflator", "brake light switch",
    "engine control module", "seatbelt pretensioner", "power steering hose",
]
CAMP_TYPE_TO_SCENARIO = {
    "service_recall": "recall_notification",
    "lease_maturity": "lease_maturity",
    "csi_survey":     "csi_survey",
    "conquest":       "appt_successful",
    "retention":      "oil_change_reminder",
}
DISP_TO_SCENARIO = {
    "complaint":          "complaint_wait_time",
    "callback_requested": "advisor_connect_failed",
}


def _fill_template(text: str, fields: dict[str, str]) -> str:
    for k, v in fields.items():
        text = text.replace(f"{{{k}}}", str(v))
    return text


def _build_transcript(
    scenario_key: str, fields: dict[str, str]
) -> tuple[list[dict], str, int]:
    template   = SCENARIO_TEMPLATES[scenario_key]
    variants   = template["turns"]
    turns_raw  = variants[int(rng.integers(0, len(variants)))]
    turns: list[dict] = []
    text_lines: list[str] = []
    word_count = 0
    for speaker, text_tpl, offset in turns_raw:
        text       = _fill_template(text_tpl, fields)
        word_count += len(text.split())
        turns.append({"speaker": speaker, "text": text, "offset_seconds": offset})
        text_lines.append(f"{speaker}: {text}")
    return turns, "\n".join(text_lines), word_count


def gen_call_transcripts(
    calls:     pd.DataFrame,
    customers: pd.DataFrame,
    agents:    pd.DataFrame,
    dealers:   pd.DataFrame,
    campaigns: pd.DataFrame,
) -> pd.DataFrame:
    cust_map     = {row.customer_id: row for row in customers.itertuples()}
    agent_map    = {row.agent_id:    row for row in agents.itertuples()}
    dealer_names = dict(zip(dealers["dealer_id"], dealers["dealer_name"]))
    camp_types   = dict(zip(campaigns["campaign_id"], campaigns["campaign_type"]))
    make_choices = ["Toyota", "Honda", "Ford", "Chevrolet", "BMW"]
    model_choices= ["Camry", "Accord", "F-150", "Equinox", "3 Series"]

    rows = []
    for idx, call in enumerate(calls.itertuples()):
        cust  = cust_map.get(call.customer_id)
        agent = agent_map.get(call.agent_id)
        cust_name  = f"{cust.first_name} {cust.last_name}" if cust else "Customer"
        agent_name = f"{agent.first_name} {agent.last_name}" if agent else "Agent"
        dealer_name = dealer_names.get(call.dealer_id, "the dealership")
        camp_type   = camp_types.get(call.campaign_id, "retention")

        # Pick scenario
        if call.disposition in DISP_TO_SCENARIO:
            scenario_key = DISP_TO_SCENARIO[call.disposition]
        elif call.disposition == "voicemail":
            scenario_key = "appt_declined"
        elif call.disposition == "no_answer":
            scenario_key = "appt_declined"
        elif call.disposition == "appointment_set":
            scenario_key = CAMP_TYPE_TO_SCENARIO.get(camp_type, "appt_successful")
        else:
            scenario_key = CAMP_TYPE_TO_SCENARIO.get(camp_type, str(rng.choice(SCENARIO_KEYS)))

        appt_date = call.call_date + timedelta(days=int(rng.integers(1, 15)))
        fields = {
            "customer_name":   cust_name,
            "agent_name":      agent_name,
            "dealer_name":     dealer_name,
            "year":            str(int(rng.choice([2019, 2020, 2021, 2022, 2023]))),
            "make":            str(rng.choice(make_choices)),
            "model":           str(rng.choice(model_choices)),
            "service_type":    str(rng.choice(SERVICE_TYPES)),
            "appt_date":       appt_date.strftime("%B %d"),
            "recall_component": str(rng.choice(RECALL_COMPONENTS)),
        }

        turns_json, transcript_text, word_count = _build_transcript(scenario_key, fields)
        rows.append({
            "transcript_id":    f"TRN{idx + 1:06d}",
            "call_id":          call.call_id,
            "transcript_json":  json.dumps(turns_json),
            "transcript_text":  transcript_text,
            "word_count":       word_count,
            "scenario_template": scenario_key,
            "created_at":       call.call_datetime,
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 9. CALL SCORES  (15,000 — tier-correlated per category)
# ═══════════════════════════════════════════════════════════════════════════════
SCORE_CATEGORIES = [
    "greeting", "active_listening", "objection_handling",
    "product_knowledge", "closing", "professionalism",
]
TIER_SCORE_RANGE = {"top": (75, 100), "mid": (55, 80), "bottom": (30, 65)}


def gen_call_scores(calls: pd.DataFrame, agents: pd.DataFrame) -> pd.DataFrame:
    agent_tier = dict(zip(agents["agent_id"], agents["skill_tier"]))
    rows = []
    for idx, call in enumerate(calls.itertuples()):
        tier = agent_tier.get(call.agent_id, "mid")
        lo, hi = TIER_SCORE_RANGE[tier]
        cat_scores = {
            cat: int(rng.integers(max(0, lo - 10), min(100, hi + 10) + 1))
            for cat in SCORE_CATEGORIES
        }
        rows.append({
            "score_id":     f"SCR{idx + 1:06d}",
            "call_id":      call.call_id,
            "agent_id":     call.agent_id,
            **cat_scores,
            "overall_score": int(np.mean(list(cat_scores.values()))),
            "scored_by":    str(rng.choice(["AI", "supervisor"])),
            "notes":        None,
            "created_at":   call.call_datetime,
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 10. APPOINTMENTS  (~30% of calls → ~4,500)
# ═══════════════════════════════════════════════════════════════════════════════
APPT_TYPES = [
    "oil_change", "tire_rotation", "brake_service", "multi_point_inspection",
    "recall_repair", "transmission_service", "sales_consultation", "lease_return",
]
APPT_STATUSES = ["scheduled", "confirmed", "showed", "no_show", "cancelled"]
APPT_STATUS_P = [0.20, 0.30, 0.35, 0.10, 0.05]


def gen_appointments(calls: pd.DataFrame) -> pd.DataFrame:
    appt_calls = calls[calls["disposition"] == "appointment_set"]
    rows = []
    for aid, call in enumerate(appt_calls.itertuples(), start=1):
        appt_dt = call.call_datetime + timedelta(
            days=int(rng.integers(1, 15)),
            hours=int(rng.integers(8, 18)),
        )
        rows.append({
            "appointment_id":       f"APT{aid:05d}",
            "call_id":              call.call_id,
            "dealer_id":            call.dealer_id,
            "agent_id":             call.agent_id,
            "customer_id":          call.customer_id,
            "appointment_datetime": appt_dt,
            "appointment_date":     appt_dt.date(),
            "appointment_type":     str(rng.choice(APPT_TYPES)),
            "status":               str(rng.choice(APPT_STATUSES, p=APPT_STATUS_P)),
            "duration_minutes":     int(rng.choice([30, 45, 60, 90, 120])),
            "notes":                None,
            "created_at":           call.call_datetime,
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 11. TASKS  (8,000)
# ═══════════════════════════════════════════════════════════════════════════════
TASK_TYPES = [
    "follow_up_call", "send_coupon", "schedule_appointment", "send_survey",
    "escalate_complaint", "confirm_appointment", "update_contact", "send_recall_info",
]


def gen_tasks(calls: pd.DataFrame, agents: pd.DataFrame, n: int = 8000) -> pd.DataFrame:
    agent_ids  = agents["agent_id"].tolist()
    dealer_ids = agents["dealer_id"].unique().tolist()
    call_ids   = calls["call_id"].tolist()
    rows = []
    for i in range(n):
        due = START_DATE + timedelta(days=int(rng.integers(0, N_DAYS + 8)))
        rows.append({
            "task_id":     f"TSK{i + 1:05d}",
            "call_id":     str(rng.choice(call_ids)) if rng.random() < 0.7 else None,
            "dealer_id":   str(rng.choice(dealer_ids)),
            "agent_id":    str(rng.choice(agent_ids)),
            "customer_id": f"CUS{int(rng.integers(1, 2001)):05d}",
            "task_type":   str(rng.choice(TASK_TYPES)),
            "priority":    str(rng.choice(["high", "medium", "low"], p=[0.25, 0.50, 0.25])),
            "status":      str(rng.choice(["pending","in_progress","completed","cancelled"],
                                          p=[0.30, 0.20, 0.40, 0.10])),
            "due_date":    due,
            "completed_at": due if rng.random() < 0.4 else None,
            "notes":       None,
            "created_at":  due - timedelta(days=int(rng.integers(0, 6))),
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 12. TEXT MESSAGES  (5,000)
# ═══════════════════════════════════════════════════════════════════════════════
TEXT_TEMPLATES = [
    "Hi {name}, this is {dealer_name}. Your {year} {make} appointment is confirmed for {date}. Reply STOP to opt out.",
    "Reminder: Your service appointment at {dealer_name} is tomorrow at {time}. See you then!",
    "Hi {name}! Your {year} {make} is ready for pickup at {dealer_name}. Please call us at your convenience.",
    "{dealer_name}: Your {year} {make} has an open recall. The repair is FREE. Call us to schedule: {phone}.",
    "Hi {name}, your {year} {make} is due for an oil change. Book online or call {dealer_name}. Reply STOP to opt out.",
    "Thank you for visiting {dealer_name}! We hope your service experience was excellent. Reply with any feedback.",
    "{dealer_name}: Parts for your {year} {make} have arrived. Call us to schedule your repair appointment.",
    "Hi {name}, this is a courtesy reminder about your lease maturity. Contact {dealer_name} to discuss your options.",
]


def gen_text_messages(
    calls:     pd.DataFrame,
    customers: pd.DataFrame,
    dealers:   pd.DataFrame,
    n:         int = 5000,
) -> pd.DataFrame:
    cust_first  = dict(zip(customers["customer_id"], customers["first_name"]))
    dealer_name = dict(zip(dealers["dealer_id"], dealers["dealer_name"]))
    dealer_ids  = dealers["dealer_id"].tolist()
    call_ids    = calls["call_id"].tolist()
    make_opts   = ["Toyota", "Honda", "Ford", "Chevrolet", "BMW"]
    rows = []
    for i in range(n):
        did      = str(rng.choice(dealer_ids))
        cust_id  = f"CUS{int(rng.integers(1, 2001)):05d}"
        fn       = cust_first.get(cust_id, "Customer")
        send_dt  = datetime(START_DATE.year, START_DATE.month, START_DATE.day) + timedelta(
            days=int(rng.integers(0, N_DAYS)), hours=int(rng.integers(8, 21)),
        )
        hour_val = int(rng.choice([9, 10, 11, 14, 15, 16]))
        minute_s = "00" if rng.random() < 0.5 else "30"
        ampm     = "AM" if hour_val < 12 else "PM"
        disp_h   = hour_val if hour_val <= 12 else hour_val - 12
        time_str = f"{disp_h}:{minute_s} {ampm}"
        tpl  = str(rng.choice(TEXT_TEMPLATES))
        body = tpl.format(
            name=fn,
            dealer_name=dealer_name.get(did, "our dealership"),
            year=int(rng.choice([2019, 2020, 2021, 2022])),
            make=str(rng.choice(make_opts)),
            date=(send_dt + timedelta(days=int(rng.integers(1, 8)))).strftime("%B %d"),
            time=time_str,
            phone=f"({int(rng.integers(200, 999))}) {int(rng.integers(200, 999))}-{int(rng.integers(1000, 9999))}",
        )
        rows.append({
            "message_id":  f"TXT{i + 1:06d}",
            "dealer_id":   did,
            "customer_id": cust_id,
            "call_id":     str(rng.choice(call_ids)) if rng.random() < 0.5 else None,
            "direction":   str(rng.choice(["outbound", "inbound"], p=[0.85, 0.15])),
            "body":        body,
            "status":      str(rng.choice(["delivered","sent","failed","received"],
                                          p=[0.80, 0.10, 0.05, 0.05])),
            "sent_at":     send_dt,
            "created_at":  send_dt,
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 13. EMAIL LOGS  (3,000)
# ═══════════════════════════════════════════════════════════════════════════════
EMAIL_SUBJECTS = [
    "Your Service Appointment Confirmation - {dealer_name}",
    "Recall Notice: Important Safety Information for Your {year} {make}",
    "Your {year} {make} is Due for Service - Schedule Today",
    "CSI Survey - Tell Us About Your Recent Visit to {dealer_name}",
    "Lease Maturity Notice - Your Options Await",
    "Thank You for Visiting {dealer_name}",
    "Service Reminder: {year} {make} {service_type}",
    "Exclusive Offer: Save on Your Next Service at {dealer_name}",
]


def gen_email_logs(
    calls:     pd.DataFrame,
    customers: pd.DataFrame,
    dealers:   pd.DataFrame,
    n:         int = 3000,
) -> pd.DataFrame:
    cust_email  = dict(zip(customers["customer_id"], customers["email"]))
    dealer_name = dict(zip(dealers["dealer_id"], dealers["dealer_name"]))
    dealer_ids  = dealers["dealer_id"].tolist()
    call_ids    = calls["call_id"].tolist()
    make_opts   = ["Toyota", "Honda", "Ford", "Chevrolet", "BMW"]
    rows = []
    for i in range(n):
        did     = str(rng.choice(dealer_ids))
        cust_id = f"CUS{int(rng.integers(1, 2001)):05d}"
        dname   = dealer_name.get(did, "our dealership")
        send_dt = datetime(START_DATE.year, START_DATE.month, START_DATE.day) + timedelta(
            days=int(rng.integers(0, N_DAYS)), hours=int(rng.integers(8, 21)),
        )
        subj = str(rng.choice(EMAIL_SUBJECTS)).format(
            dealer_name=dname,
            year=int(rng.choice([2019, 2020, 2021, 2022])),
            make=str(rng.choice(make_opts)),
            service_type=str(rng.choice(SERVICE_TYPES)),
        )
        opened_at = (
            send_dt + timedelta(hours=int(rng.integers(1, 49)))
            if rng.random() < 0.35 else None
        )
        rows.append({
            "email_id":    f"EML{i + 1:05d}",
            "dealer_id":   did,
            "customer_id": cust_id,
            "call_id":     str(rng.choice(call_ids)) if rng.random() < 0.4 else None,
            "to_email":    cust_email.get(cust_id, f"customer{i}@gmail.com"),
            "from_email":  f"service@{dname.lower().replace(' ', '')}.com",
            "subject":     subj,
            "status":      str(rng.choice(["delivered","opened","bounced","unsubscribed"],
                                          p=[0.55, 0.35, 0.07, 0.03])),
            "opened_at":   opened_at,
            "sent_at":     send_dt,
            "created_at":  send_dt,
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 14. CALL AI ENRICHMENTS  (15,000 — pre-computed Cortex AI output)
# ═══════════════════════════════════════════════════════════════════════════════
FOLLOW_UP_ACTIONS = [
    "Schedule follow-up call for next week",
    "Send service coupon via email",
    "Escalate to service manager",
    "Send appointment confirmation text",
    "Add to retention campaign",
    "Transfer to sales team",
    "Log callback for 2 weeks",
    "Send recall information via email",
    "Mark as do-not-call and update CRM",
    "No follow-up needed — appointment confirmed",
]
OBJECTIONS = [
    "Too expensive",
    "Already have a mechanic",
    "Too busy right now",
    "Just had service done",
    "Not ready to commit",
    None, None, None,  # weight toward no objection
]
TIER_SENTIMENT = {
    "top":    (0.30,  0.80),
    "mid":    (0.00,  0.40),
    "bottom": (-0.30, 0.10),
}
SCENARIO_DISP_CLASS = {
    "appt_successful":       "service_appointment",
    "appt_declined":         "callback_request",
    "recall_notification":   "service_appointment",
    "oil_change_reminder":   "service_appointment",
    "lease_maturity":        "sales_appointment",
    "csi_survey":            "information_only",
    "parts_status":          "information_only",
    "advisor_connect_success": "information_only",
    "advisor_connect_failed":  "callback_request",
    "complaint_wait_time":   "complaint",
    "appt_confirmation":     "information_only",
    "sales_inquiry":         "sales_appointment",
}


def gen_call_ai_enrichments(
    calls:       pd.DataFrame,
    agents:      pd.DataFrame,
    transcripts: pd.DataFrame,
) -> pd.DataFrame:
    agent_tier   = dict(zip(agents["agent_id"], agents["skill_tier"]))
    scenario_map = dict(zip(transcripts["call_id"], transcripts["scenario_template"]))
    make_opts    = ["Toyota", "Honda", "Ford", "Chevrolet", "BMW"]
    model_opts   = ["Camry", "Accord", "F-150", "Equinox", "3 Series"]
    rows = []
    for idx, call in enumerate(calls.itertuples()):
        tier            = agent_tier.get(call.agent_id, "mid")
        lo, hi          = TIER_SENTIMENT[tier]
        sentiment_score = round(float(rng.uniform(lo, hi)), 3)
        sentiment_label = (
            "positive" if sentiment_score > 0.3
            else "negative" if sentiment_score < -0.3
            else "neutral"
        )
        scenario     = scenario_map.get(call.call_id, "appt_successful")
        disp_class   = SCENARIO_DISP_CLASS.get(scenario, "information_only")
        template     = SCENARIO_TEMPLATES.get(scenario, SCENARIO_TEMPLATES["appt_successful"])
        summary_tpl  = template["summary"]
        appt_day_offset = int(rng.integers(1, 11))
        summary = _fill_template(summary_tpl, {
            "customer_name": "the customer",
            "year":          str(int(rng.choice([2019, 2020, 2021, 2022]))),
            "make":          str(rng.choice(make_opts)),
            "model":         str(rng.choice(model_opts)),
            "appt_date":     (call.call_date + timedelta(days=appt_day_offset)).strftime("%B %d"),
            "service_type":  str(rng.choice(SERVICE_TYPES)),
        })
        has_appt  = call.disposition == "appointment_set"
        appt_date = (call.call_date + timedelta(days=appt_day_offset)) if has_appt else None
        objection = None if has_appt else str(rng.choice(OBJECTIONS))
        rows.append({
            "enrichment_id":             f"ENR{idx + 1:06d}",
            "call_id":                   call.call_id,
            "sentiment_score":           sentiment_score,
            "sentiment_label":           sentiment_label,
            "call_summary":              summary,
            "disposition_class":         disp_class,
            "follow_up_action":          str(rng.choice(FOLLOW_UP_ACTIONS)),
            "customer_objections":       objection if objection != "None" else None,
            "appointment_date_extracted": appt_date,
            "model_version":             "cortex-llm-v1.2",
            "processed_at":              call.call_datetime + timedelta(minutes=int(rng.integers(1, 31))),
            "created_at":                call.call_datetime,
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 15. AGENT DAILY METRICS  (30 agents × 30 days = 900)
# ═══════════════════════════════════════════════════════════════════════════════
TIER_DAILY = {
    "top":    {"calls": (35, 55), "aht": (180, 360), "conv": (0.40, 0.50), "score": (75, 100)},
    "mid":    {"calls": (25, 40), "aht": (120, 240), "conv": (0.25, 0.35), "score": (55, 80)},
    "bottom": {"calls": (15, 30), "aht": (60, 150),  "conv": (0.10, 0.20), "score": (30, 65)},
}


def gen_agent_daily_metrics(agents: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for day_offset in range(N_DAYS):  # 30 days, no weekend skip → exactly 900 rows
        current_date = START_DATE + timedelta(days=day_offset)
        for _, agent in agents.iterrows():
            tier = agent["skill_tier"]
            m    = TIER_DAILY[tier]
            total  = int(rng.integers(*m["calls"]))
            aht    = int(rng.integers(*m["aht"]))
            conv   = round(float(rng.uniform(*m["conv"])), 3)
            score  = int(rng.integers(m["score"][0], m["score"][1] + 1))
            rows.append({
                "metric_id":               f"MET{len(rows) + 1:06d}",
                "agent_id":                agent["agent_id"],
                "dealer_id":               agent["dealer_id"],
                "metric_date":             current_date,
                "total_calls":             total,
                "connected_calls":         int(total * float(rng.uniform(0.55, 0.71))),
                "appointments_set":        int(total * conv),
                "voicemails_left":         int(total * float(rng.uniform(0.20, 0.30))),
                "avg_handle_time_seconds": aht,
                "total_talk_time_seconds": total * aht,
                "conversion_rate":         conv,
                "avg_call_score":          score,
                "created_at":              datetime(current_date.year, current_date.month, current_date.day),
            })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# 16. PIPELINE STATUS  (6 rows)
# ═══════════════════════════════════════════════════════════════════════════════
def gen_pipeline_status() -> pd.DataFrame:
    pipelines = [
        ("PIPE001", "call_ingestion",        "running", "Call recordings ingested and transcribed daily", None),
        ("PIPE002", "ai_enrichment",         "running", "Cortex AI enrichment processing call transcripts", None),
        ("PIPE003", "score_calculation",     "running", "Agent score calculation from AI enrichments", None),
        ("PIPE004", "daily_metrics_rollup",  "running", "Agent daily metrics aggregation", None),
        ("PIPE005", "campaign_assignment",   "running", "Customer-to-campaign assignment logic", None),
        ("PIPE006", "appointment_sync",      "warning", "Appointment sync from DMS — delay detected",
                    "DMS sync timeout after 30s — retrying"),
    ]
    rows = []
    for pid, name, status, desc, err in pipelines:
        last_run = datetime.now() - timedelta(hours=int(rng.integers(1, 25)))
        rows.append({
            "pipeline_id":       pid,
            "pipeline_name":     name,
            "status":            status,
            "description":       desc,
            "last_run_at":       last_run,
            "next_run_at":       last_run + timedelta(hours=24),
            "records_processed": int(rng.integers(1000, 50001)),
            "error_message":     err,
            "created_at":        datetime(2024, 1, 1),
        })
    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("Generating BDC synthetic data (seed=42)...")
    print(f"Output: {OUTPUT_DIR}\n")

    dealers          = gen_dealers()
    save(dealers, "dealers")

    agents           = gen_agents(dealers)
    save(agents, "agents")

    customers        = gen_customers(2000)
    save(customers, "customers")

    vehicles         = gen_vehicles(customers, dealers)
    save(vehicles, "vehicles")

    service_history  = gen_service_history(vehicles, 10000)
    save(service_history, "service_history")

    campaigns        = gen_campaigns(dealers)
    save(campaigns, "campaigns")

    calls            = gen_calls(agents, customers, campaigns, 15000)
    save(calls, "calls")

    call_transcripts = gen_call_transcripts(calls, customers, agents, dealers, campaigns)
    save(call_transcripts, "call_transcripts")

    call_scores      = gen_call_scores(calls, agents)
    save(call_scores, "call_scores")

    appointments     = gen_appointments(calls)
    save(appointments, "appointments")

    tasks            = gen_tasks(calls, agents, 8000)
    save(tasks, "tasks")

    text_messages    = gen_text_messages(calls, customers, dealers, 5000)
    save(text_messages, "text_messages")

    email_logs       = gen_email_logs(calls, customers, dealers, 3000)
    save(email_logs, "email_logs")

    call_ai_enrichments = gen_call_ai_enrichments(calls, agents, call_transcripts)
    save(call_ai_enrichments, "call_ai_enrichments")

    agent_daily_metrics = gen_agent_daily_metrics(agents)
    save(agent_daily_metrics, "agent_daily_metrics")

    pipeline_status  = gen_pipeline_status()
    save(pipeline_status, "pipeline_status")

    print("\nDone!")
