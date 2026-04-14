from pydantic import BaseModel


class PSCompany(BaseModel):
    Code: str
    Name: str
    Type: str


class PSEndpoint(BaseModel):
    Name: str | None = None
    ServiceType: str | None = None
    Version: str | None = None
    Status: str | None = None
    ProductionURL: str | None = None
    TestURL: str | None = None
