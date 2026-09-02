from pydantic import BaseModel


class AdminDocumentCreate(BaseModel):

    document_name: str
    category: str = "General"

    access_type: str = "all"

    department: str | None = None

    employee_id: int | None = None

    can_view: bool = True

    can_download: bool = True