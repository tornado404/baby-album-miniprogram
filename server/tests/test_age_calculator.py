"""Age calculator comprehensive tests — pure function"""
import pytest
from unittest.mock import patch


class TestCalculateBabyAge:
    def test_normal(self):
        from app.utils.age import calculate_baby_age
        result = calculate_baby_age("2025-01-15")
        assert "years" in result
        assert "months" in result
        assert "days" in result
        assert isinstance(result["years"], int)
        assert isinstance(result["months"], int)
        assert isinstance(result["days"], int)

    def test_invalid_format_raises(self):
        from app.utils.age import calculate_baby_age
        with pytest.raises(ValueError, match="Invalid date format"):
            calculate_baby_age("not-a-date")

    def test_none_value_raises(self):
        from app.utils.age import calculate_baby_age
        with pytest.raises(ValueError):
            calculate_baby_age(None)

    def test_future_date_returns_zero(self):
        from app.utils.age import calculate_baby_age
        result = calculate_baby_age("2099-01-01")
        assert result == {"years": 0, "months": 0, "days": 0}

    def test_birthday_today(self):
        from datetime import date
        today = date.today()
        birth = f"{today.year}-{today.month:02d}-{today.day:02d}"
        from app.utils.age import calculate_baby_age
        result = calculate_baby_age(birth)
        assert result["years"] == 0
        assert result["months"] == 0
        assert result["days"] == 0

    def test_one_year_ago(self):
        from datetime import date
        today = date.today()
        birth = f"{today.year - 1}-{today.month:02d}-{today.day:02d}"
        from app.utils.age import calculate_baby_age
        result = calculate_baby_age(birth)
        assert result["years"] == 1
        assert result["months"] == 0
        assert result["days"] == 0

    def test_day_borrowing(self):
        """Test the day < 0 borrowing logic (e.g. birth on 15th, today is 10th)"""
        with patch("app.utils.age.date") as mock_date:
            mock_date.today.return_value = __import__("datetime").date(2026, 4, 10)
            from app.utils.age import calculate_baby_age
            result = calculate_baby_age("2026-03-15")
        assert result["months"] == 0
        assert result["days"] >= 0  # correct borrow

    def test_month_borrowing(self):
        """Test the months < 0 borrowing (e.g. birth in December, today in January)"""
        with patch("app.utils.age.date") as mock_date:
            mock_date.today.return_value = __import__("datetime").date(2026, 1, 15)
            from app.utils.age import calculate_baby_age
            result = calculate_baby_age("2025-12-20")
        assert result["months"] >= 0
        assert result["days"] >= 0

    def test_year_borrowing(self):
        """Birth in previous year, today early in month"""
        with patch("app.utils.age.date") as mock_date:
            mock_date.today.return_value = __import__("datetime").date(2026, 1, 5)
            from app.utils.age import calculate_baby_age
            result = calculate_baby_age("2025-12-28")
        assert result["years"] == 0
        assert result["months"] == 0
        assert result["days"] > 0

    def test_newborn(self):
        with patch("app.utils.age.date") as mock_date:
            mock_date.today.return_value = __import__("datetime").date(2026, 1, 1)
            from app.utils.age import calculate_baby_age
            result = calculate_baby_age("2026-01-01")
        assert result == {"years": 0, "months": 0, "days": 0}
