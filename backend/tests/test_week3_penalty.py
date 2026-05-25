"""
Tests for Week 3 — Penalty Exposure Engine.

These tests exercise the penalty calculation logic in isolation (no DB)
so they run fast in CI without a live PostgreSQL connection.
"""
from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest

from app.api.v1.endpoints.analytics import _calculate_penalty
from app.models.deadline import Deadline, DeadlineCategory, DeadlineStatus


def _make_deadline(**kwargs) -> Deadline:
    """Helper: build a Deadline ORM object with sensible defaults."""
    dl = MagicMock(spec=Deadline)
    dl.id = kwargs.get("id", 1)
    dl.name = kwargs.get("name", "Test Deadline")
    dl.category = kwargs.get("category", DeadlineCategory.BURS)
    dl.status = kwargs.get("status", DeadlineStatus.MISSED)
    dl.due_date = kwargs.get("due_date", date.today() - timedelta(days=30))
    dl.fixed_penalty_bwp = kwargs.get("fixed_penalty_bwp", 1000.0)
    dl.monthly_interest_rate = kwargs.get("monthly_interest_rate", 0.015)
    dl.estimated_outstanding_bwp = kwargs.get("estimated_outstanding_bwp", None)
    return dl


class TestPenaltyCalculation:
    """Unit tests for _calculate_penalty."""

    def test_fixed_penalty_only_no_outstanding(self):
        """If no outstanding amount, only fixed penalty is charged."""
        today = date(2026, 5, 25)
        dl = _make_deadline(
            due_date=date(2026, 4, 25),  # 30 days overdue
            fixed_penalty_bwp=1000.0,
            monthly_interest_rate=0.015,
            estimated_outstanding_bwp=None,
        )
        result = _calculate_penalty(dl, today)

        assert result["fixed_penalty_bwp"] == 1000.0
        assert result["interest_penalty_bwp"] == 0.0
        assert result["total_penalty_bwp"] == 1000.0
        assert result["is_minimum_estimate"] is True

    def test_interest_accrues_with_outstanding_amount(self):
        """Interest = outstanding * rate * months_overdue."""
        today = date(2026, 5, 25)
        dl = _make_deadline(
            due_date=date(2026, 4, 25),  # 30 days → 1 month overdue
            fixed_penalty_bwp=1000.0,
            monthly_interest_rate=0.015,
            estimated_outstanding_bwp=10_000.0,
        )
        result = _calculate_penalty(dl, today)

        # 10,000 * 0.015 * (30/30) = 150.0
        assert result["interest_penalty_bwp"] == pytest.approx(150.0, abs=0.01)
        assert result["total_penalty_bwp"] == pytest.approx(1150.0, abs=0.01)
        assert result["is_minimum_estimate"] is False

    def test_7_day_projection_grows(self):
        """Penalty in 7 days should always be >= penalty today."""
        today = date(2026, 5, 25)
        dl = _make_deadline(
            due_date=date(2026, 4, 25),
            fixed_penalty_bwp=500.0,
            monthly_interest_rate=0.015,
            estimated_outstanding_bwp=5_000.0,
        )
        result = _calculate_penalty(dl, today)
        assert result["penalty_in_7_days_bwp"] >= result["total_penalty_bwp"]

    def test_not_yet_overdue_returns_zero_days(self):
        """Deadline due in the future: days_overdue = 0, penalty = fixed only."""
        today = date(2026, 5, 25)
        dl = _make_deadline(
            due_date=today + timedelta(days=5),  # future
            fixed_penalty_bwp=1000.0,
            monthly_interest_rate=0.015,
            estimated_outstanding_bwp=10_000.0,
        )
        result = _calculate_penalty(dl, today)
        # days_overdue capped at 0, so no interest
        assert result["days_overdue"] == 0
        assert result["interest_penalty_bwp"] == 0.0
        assert result["total_penalty_bwp"] == 1000.0

    def test_cipa_flat_fee_no_interest_rate(self):
        """CIPA deadlines have no interest rate — only flat monthly fee."""
        today = date(2026, 5, 25)
        dl = _make_deadline(
            category=DeadlineCategory.CIPA,
            due_date=date(2026, 4, 25),
            fixed_penalty_bwp=250.0,
            monthly_interest_rate=None,     # CIPA has no interest rate
            estimated_outstanding_bwp=None,
        )
        result = _calculate_penalty(dl, today)
        assert result["fixed_penalty_bwp"] == 250.0
        assert result["interest_penalty_bwp"] == 0.0
        assert result["total_penalty_bwp"] == 250.0

    def test_paye_bwp_500_fixed(self):
        """PAYE penalty schedule: BWP 500 fixed."""
        today = date(2026, 5, 25)
        dl = _make_deadline(
            name="PAYE Remittance - April 2026",
            due_date=date(2026, 5, 15),  # 10 days overdue
            fixed_penalty_bwp=500.0,
            monthly_interest_rate=0.015,
            estimated_outstanding_bwp=None,
        )
        result = _calculate_penalty(dl, today)
        assert result["fixed_penalty_bwp"] == 500.0
        assert result["total_penalty_bwp"] == 500.0
        assert result["days_overdue"] == 10


class TestHealthScoreLogic:
    """Unit tests for health score calculation helpers."""

    def test_complete_deadline_scores_100(self):
        from app.api.v1.endpoints.analytics import _score_deadline
        dl = _make_deadline(status=DeadlineStatus.COMPLETE, due_date=date(2026, 3, 31))
        assert _score_deadline(dl, date(2026, 5, 25)) == 100

    def test_missed_deadline_scores_zero(self):
        from app.api.v1.endpoints.analytics import _score_deadline
        dl = _make_deadline(status=DeadlineStatus.MISSED, due_date=date(2026, 3, 31))
        assert _score_deadline(dl, date(2026, 5, 25)) == 0

    def test_pending_future_deadline_scores_75(self):
        from app.api.v1.endpoints.analytics import _score_deadline
        dl = _make_deadline(status=DeadlineStatus.PENDING, due_date=date(2026, 12, 31))
        assert _score_deadline(dl, date(2026, 5, 25)) == 75

    def test_pending_overdue_deadline_scores_zero(self):
        from app.api.v1.endpoints.analytics import _score_deadline
        dl = _make_deadline(status=DeadlineStatus.PENDING, due_date=date(2026, 3, 31))
        assert _score_deadline(dl, date(2026, 5, 25)) == 0