import re
import unicodedata
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.organization import Organization
from openforest.api.schemas.organization import OrganizationCreate, OrganizationUpdate


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = unicodedata.normalize("NFKD", slug)
    slug = slug.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug.strip("-")


def _generate_unique_slug(session: Session, name: str) -> str:
    slug = _slugify(name)
    candidate = slug
    counter = 1
    while session.exec(select(Organization).where(Organization.slug == candidate)).first():
        candidate = f"{slug}-{counter}"
        counter += 1
    return candidate


def _check_slug_unique(session: Session, slug: str, exclude_id: UUID | None = None) -> None:
    existing = session.exec(select(Organization).where(Organization.slug == slug)).first()
    if existing and (exclude_id is None or existing.id != exclude_id):
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Slug '{slug}' já está em uso",
                    "type": "conflict",
                }
            ],
        )


def create_organization(session: Session, data: OrganizationCreate) -> Organization:
    if data.slug:
        _check_slug_unique(session, data.slug.strip())
        slug = data.slug.strip()
    else:
        slug = _generate_unique_slug(session, data.name)

    organization = Organization(**data.model_dump(exclude={"slug"}), slug=slug)
    session.add(organization)
    session.commit()
    session.refresh(organization)
    return organization


def get_organization(session: Session, organization_id: UUID) -> Organization | None:
    return session.get(Organization, organization_id)


def list_organizations(session: Session) -> list[Organization]:
    return list(session.exec(select(Organization)).all())


def update_organization(
    session: Session, organization_id: UUID, data: OrganizationUpdate
) -> Organization | None:
    organization = session.get(Organization, organization_id)
    if not organization:
        return None

    update_data = data.model_dump(exclude_unset=True)

    if "slug" in update_data:
        slug = update_data["slug"]
        if slug and slug.strip() != organization.slug:
            _check_slug_unique(session, slug.strip(), exclude_id=organization.id)
            update_data["slug"] = slug.strip()
        elif not slug or not slug.strip():
            update_data["slug"] = _generate_unique_slug(session, organization.name)

    for field, value in update_data.items():
        setattr(organization, field, value)
    session.commit()
    session.refresh(organization)
    return organization


def delete_organization(session: Session, organization_id: UUID) -> bool:
    organization = session.get(Organization, organization_id)
    if not organization:
        return False
    session.delete(organization)
    session.commit()
    return True
