"""Media schemas Pydantic model tests"""
from app.schemas.media import MediaCreate, MediaUpdate, MediaResponse


class TestMediaCreate:
    def test_required_fields(self):
        m = MediaCreate(babyId="b1", cosKey="photos/test.jpg", captureDate="2026-01-01")
        assert m.babyId == "b1"

    def test_defaults(self):
        m = MediaCreate(babyId="b1", cosKey="k", captureDate="d")
        assert m.title == ""
        assert m.type == "image"
        assert m.locationName is None
        assert m.tags is None

    def test_with_all_fields(self):
        m = MediaCreate(babyId="b1", title="Test", type="video", cosKey="k",
                        captureDate="d", locationName="Home", tags=["a", "b"],
                        moment="play", milestone="first")
        assert m.title == "Test"
        assert len(m.tags) == 2


class TestMediaUpdate:
    def test_empty(self):
        u = MediaUpdate()
        assert u.title is None
        assert u.isArchived is None

    def test_partial(self):
        u = MediaUpdate(title="New")
        assert u.title == "New"
        assert u.locationName is None

    def test_all_fields(self):
        u = MediaUpdate(title="t", locationName="l", tags=["x"], moment="m",
                        milestone="ms", isArchived=True)
        assert u.isArchived is True


class TestMediaResponse:
    def test_defaults(self):
        r = MediaResponse(id="m1", type="image", title="t", captureDate="d")
        assert r.fileSize == 0
        assert r.isArchived is False

    def test_with_all_fields(self):
        r = MediaResponse(id="m1", type="video", title="Video", cosUrl="url",
                          captureDate="d", fileSize=100, tags=["tag1"])
        assert r.fileSize == 100
        assert r.tags == ["tag1"]