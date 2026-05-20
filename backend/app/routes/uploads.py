"""Upload routes: accept a CSV, parse, persist."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Email, Upload
from app.schemas import UploadCreateResponse, UploadStatusResponse
from app.services.csv_parser import CsvValidationError, parse_emails_csv

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB cap on uploads


@router.post("", response_model=UploadCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
) -> UploadCreateResponse:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expected a .csv file.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_FILE_BYTES // (1024 * 1024)} MB limit.",
        )

    try:
        result = parse_emails_csv(content)
    except CsvValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    upload = Upload(filename=file.filename, email_count=len(result.rows))
    db.add(upload)
    db.flush()  # so upload.id is populated

    for row in result.rows:
        db.add(
            Email(
                upload_id=upload.id,
                source_id=row.source_id,
                sender=row.sender,
                recipients=row.recipients,
                cc=row.cc,
                subject=row.subject,
                sent_at=row.sent_at,
                body=row.body,
            )
        )

    db.commit()
    db.refresh(upload)

    return UploadCreateResponse(
        upload_id=upload.id,
        email_count=upload.email_count,
        warnings=result.warnings,
    )


@router.get("/{upload_id}/status", response_model=UploadStatusResponse)
def get_upload_status(
    upload_id: str,
    db: Session = Depends(get_session),
) -> UploadStatusResponse:
    upload = db.get(Upload, upload_id)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")
    return UploadStatusResponse.model_validate(upload)


@router.get("", response_model=list[UploadStatusResponse])
def list_uploads(db: Session = Depends(get_session)) -> list[UploadStatusResponse]:
    uploads = db.query(Upload).order_by(Upload.created_at.desc()).all()
    return [UploadStatusResponse.model_validate(u) for u in uploads]
