from sqlalchemy.dialects.postgresql import UUID

class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), index=True
    )

    type: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(255))
    total_marks: Mapped[int] = mapped_column(Integer)
    weightage: Mapped[int] = mapped_column(Integer)
    date_conducted: Mapped[date] = mapped_column(Date)

    clos = relationship("CourseCLO", secondary=assessment_clos, back_populates="assessments")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
