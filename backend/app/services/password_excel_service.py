from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User


def get_password_documentation_dir() -> Path:
    """Return the absolute path to the credentials directory, ensuring it exists."""
    credentials_dir = Path(settings.BASE_DIR) / "storage" / "credentials"
    credentials_dir.mkdir(parents=True, exist_ok=True)
    return credentials_dir


def get_password_documentation_file_path() -> Path:
    """Return the default path to the maintained password documentation Excel spreadsheet."""
    return get_password_documentation_dir() / "employee_passwords_documentation.xlsx"


def generate_password_documentation_workbook(db: Session) -> Workbook:
    """
    Build a professionally styled Excel workbook containing complete password
    and credential documentation for all employees and system accounts.
    """
    users = (
        db.query(User)
        .order_by(
            User.role.asc(),
            User.created_at.asc(),
        )
        .all()
    )

    workbook = Workbook()
    sheet = workbook.active
    if sheet is None:
        sheet = workbook.create_sheet("Password Documentation")
    sheet.title = "Password Documentation"
    sheet.views.sheetView[0].showGridLines = True

    # Palettes
    navy_fill = PatternFill(start_color="1E1B4B", end_color="1E1B4B", fill_type="solid")
    indigo_fill = PatternFill(start_color="312E81", end_color="312E81", fill_type="solid")
    sub_fill = PatternFill(start_color="4338CA", end_color="4338CA", fill_type="solid")
    header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    alt_row_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    pwd_cell_fill = PatternFill(start_color="EEF2FF", end_color="EEF2FF", fill_type="solid")

    font_banner_title = Font(name="Calibri", size=15, bold=True, color="FFFFFF")
    font_banner_sub = Font(name="Calibri", size=11, bold=True, color="E0E7FF")
    font_banner_meta = Font(name="Calibri", size=9, italic=True, color="C7D2FE")
    font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    font_data = Font(name="Calibri", size=10, color="0F172A")
    font_pwd = Font(name="Consolas", size=10, bold=True, color="312E81")

    thin_border_side = Side(border_style="thin", color="CBD5E1")
    cell_border = Border(
        top=thin_border_side,
        bottom=thin_border_side,
        left=thin_border_side,
        right=thin_border_side,
    )

    headers = [
        "ID",
        "Employee ID",
        "Full Name",
        "Email (Login ID)",
        "Password Reference",
        "Role",
        "Department",
        "Designation",
        "Status",
        "Mobile Number",
        "Storage (GB)",
        "Account Created",
    ]

    max_col_letter = get_column_letter(len(headers))

    # Banner Row 1: System Title
    sheet.merge_cells(f"A1:{max_col_letter}1")
    cell_top = sheet["A1"]
    cell_top.value = "EMPLOYEE DOCUMENT MANAGEMENT SYSTEM (EDMS)"
    cell_top.font = font_banner_title
    cell_top.fill = navy_fill
    cell_top.alignment = Alignment(horizontal="center", vertical="center")
    sheet.row_dimensions[1].height = 28

    # Banner Row 2: Documentation Subtitle
    sheet.merge_cells(f"A2:{max_col_letter}2")
    cell_mid = sheet["A2"]
    cell_mid.value = "CONFIDENTIAL CREDENTIAL & PASSWORD DOCUMENTATION"
    cell_mid.font = font_banner_sub
    cell_mid.fill = indigo_fill
    cell_mid.alignment = Alignment(horizontal="center", vertical="center")
    sheet.row_dimensions[2].height = 22

    # Banner Row 3: Metadata & Confidentiality Warning
    sync_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sheet.merge_cells(f"A3:{max_col_letter}3")
    cell_bot = sheet["A3"]
    cell_bot.value = (
        f"STRICTLY CONFIDENTIAL | FOR INTERNAL MANAGEMENT ONLY | Synchronized: {sync_time_str}"
    )
    cell_bot.font = font_banner_meta
    cell_bot.fill = sub_fill
    cell_bot.alignment = Alignment(horizontal="center", vertical="center")
    sheet.row_dimensions[3].height = 18

    # Row 4: Spacer
    sheet.row_dimensions[4].height = 10

    # Row 5: Column Headers
    sheet.row_dimensions[5].height = 24
    for col_idx, header_text in enumerate(headers, start=1):
        cell = sheet.cell(row=5, column=col_idx, value=header_text)
        cell.font = font_header
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = cell_border

    # Populate Data
    start_row = 6
    for idx, user in enumerate(users):
        row_num = start_row + idx
        sheet.row_dimensions[row_num].height = 20
        is_even = (idx % 2 == 1)

        # Role formatting
        role_label = user.role.title() if user.role else "Employee"
        if user.role == "readonlyemployee":
            role_label = "Read-Only Employee"
        elif user.role == "admin":
            role_label = "Administrator"

        status_label = user.status.title() if user.status else "Active"
        created_str = (
            user.created_at.strftime("%Y-%m-%d %H:%M")
            if user.created_at
            else ""
        )
        storage_gb = round((user.storage_limit_bytes or 0) / (1024 ** 3), 2)
        pwd_val = user.password_reference or "(hash secured)"

        row_values = [
            user.id,
            user.employee_id,
            user.full_name,
            user.email,
            pwd_val,
            role_label,
            user.department,
            user.designation,
            status_label,
            user.mobile_number,
            storage_gb,
            created_str,
        ]

        for col_idx, value in enumerate(row_values, start=1):
            cell = sheet.cell(row=row_num, column=col_idx, value=value)
            cell.border = cell_border

            # Default font and fill
            if col_idx == 5:
                # Password column
                cell.font = font_pwd
                cell.fill = pwd_cell_fill
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.font = font_data
                if is_even:
                    cell.fill = alt_row_fill

                if col_idx in {1, 2, 9, 11, 12}:
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                else:
                    cell.alignment = Alignment(horizontal="left", vertical="center")

    # Column Auto-Widths
    min_widths = {
        "A": 8,   # ID
        "B": 16,  # Employee ID
        "C": 24,  # Full Name
        "D": 32,  # Email
        "E": 22,  # Password Reference
        "F": 20,  # Role
        "G": 18,  # Department
        "H": 22,  # Designation
        "I": 14,  # Status
        "J": 18,  # Mobile Number
        "K": 16,  # Storage
        "L": 20,  # Created Date
    }

    for col_letter, min_w in min_widths.items():
        sheet.column_dimensions[col_letter].width = min_w

    # Freeze panes below headers
    sheet.freeze_panes = "A6"

    # Auto-filter on headers
    if users:
        sheet.auto_filter.ref = f"A5:{max_col_letter}{start_row + len(users) - 1}"

    return workbook


def sync_password_documentation_file(db: Session) -> Path:
    """
    Regenerate and maintain the physical password documentation Excel file on disk.
    Called automatically on registration, password reset, or admin updates.
    """
    file_path = get_password_documentation_file_path()
    workbook = generate_password_documentation_workbook(db)
    workbook.save(str(file_path))
    return file_path


def get_password_documentation_bytes(db: Session) -> BytesIO:
    """
    Generate the password documentation workbook and return it as a BytesIO stream
    ready for HTTP streaming download.
    """
    workbook = generate_password_documentation_workbook(db)
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def delete_password_documentation_file() -> bool:
    """
    Delete the maintained password documentation Excel file from disk.
    Returns True if file existed and was removed, False otherwise.
    """
    file_path = get_password_documentation_file_path()
    if file_path.exists():
        file_path.unlink()
        return True
    return False


def get_excel_sheet_data(db: Session) -> dict:
    """
    Return comprehensive metadata and structured rows for the maintained Excel sheet.
    """
    file_path = get_password_documentation_file_path()
    file_exists = file_path.exists()

    file_size_bytes = 0
    last_synchronized = None
    if file_exists:
        try:
            stat = file_path.stat()
            file_size_bytes = stat.st_size
            last_synchronized = datetime.fromtimestamp(stat.st_mtime).isoformat()
        except Exception:
            pass

    users = (
        db.query(User)
        .order_by(User.role.asc(), User.created_at.asc())
        .all()
    )

    rows = []
    for u in users:
        storage_gb = round((u.storage_limit_bytes or 0) / (1024 ** 3), 2)
        rows.append({
            "id": u.id,
            "employee_id": u.employee_id,
            "full_name": u.full_name,
            "email": u.email,
            "password_reference": u.password_reference or "(hash secured)",
            "role": u.role,
            "department": u.department,
            "designation": u.designation,
            "status": u.status,
            "mobile_number": u.mobile_number,
            "storage_gb": storage_gb,
            "storage_limit_bytes": u.storage_limit_bytes,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return {
        "exists": file_exists,
        "file_name": file_path.name,
        "file_path": "storage/credentials/employee_passwords_documentation.xlsx",
        "file_size_bytes": file_size_bytes,
        "last_synchronized": last_synchronized,
        "total_records": len(rows),
        "rows": rows,
    }


def update_excel_rows(db: Session, rows_data: list) -> dict:
    """
    Update database employee records from inline edited spreadsheet rows,
    then automatically re-synchronize the maintained Excel spreadsheet file.
    """
    updated_count = 0
    errors = []

    for row in rows_data:
        user_id = row.get("id")
        emp_id = row.get("employee_id")
        email = row.get("email")

        user = None
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        elif emp_id:
            user = db.query(User).filter(User.employee_id == str(emp_id).strip()).first()
        elif email:
            user = db.query(User).filter(User.email == str(email).strip().lower()).first()

        if not user:
            errors.append(f"Employee '{emp_id or email or user_id}' not found.")
            continue

        changed = False

        # Password reference & hash update
        new_pwd = row.get("password_reference")
        if new_pwd and new_pwd != "(hash secured)":
            clean_pwd = str(new_pwd).strip()
            if len(clean_pwd) >= 6 and clean_pwd != user.password_reference:
                user.password_reference = clean_pwd
                user.password_hash = hash_password(clean_pwd)
                changed = True

        # Role
        new_role = row.get("role")
        if new_role:
            clean_role = str(new_role).strip().lower().replace(" ", "").replace("-", "")
            if clean_role in ["employee", "readonlyemployee", "admin"] and clean_role != user.role:
                user.role = clean_role
                changed = True

        # Status
        new_status = row.get("status")
        if new_status:
            clean_status = str(new_status).strip().lower()
            if clean_status in ["active", "suspended", "pending", "inactive"] and clean_status != user.status:
                user.status = clean_status
                changed = True

        # Department
        if "department" in row and row["department"] is not None:
            clean_dept = str(row["department"]).strip()
            if clean_dept and clean_dept != user.department:
                user.department = clean_dept
                changed = True

        # Designation
        if "designation" in row and row["designation"] is not None:
            clean_desig = str(row["designation"]).strip()
            if clean_desig and clean_desig != user.designation:
                user.designation = clean_desig
                changed = True

        # Mobile number
        if "mobile_number" in row and row["mobile_number"] is not None:
            clean_mob = str(row["mobile_number"]).strip()
            if clean_mob and clean_mob != user.mobile_number:
                user.mobile_number = clean_mob
                changed = True

        # Storage
        if "storage_gb" in row and row["storage_gb"] is not None:
            try:
                gb_val = float(row["storage_gb"])
                bytes_val = int(gb_val * (1024 ** 3))
                if bytes_val >= 50 * 1024 * 1024 and bytes_val != user.storage_limit_bytes:
                    user.storage_limit_bytes = bytes_val
                    changed = True
            except (ValueError, TypeError):
                pass
        elif "storage_limit_bytes" in row and row["storage_limit_bytes"] is not None:
            try:
                bytes_val = int(row["storage_limit_bytes"])
                if bytes_val >= 50 * 1024 * 1024 and bytes_val != user.storage_limit_bytes:
                    user.storage_limit_bytes = bytes_val
                    changed = True
            except (ValueError, TypeError):
                pass

        if changed:
            updated_count += 1

    if updated_count > 0:
        db.commit()

    # Re-sync Excel file on disk
    sync_password_documentation_file(db)

    return {
        "updated_count": updated_count,
        "errors": errors,
    }


def import_excel_sheet(db: Session, file_bytes: bytes) -> dict:
    """
    Parse an uploaded .xlsx Excel file, extract employee records & credentials,
    update existing database users, and regenerate the maintained Excel sheet.
    """
    wb = load_workbook(BytesIO(file_bytes), data_only=True)
    sheet = wb.active
    if sheet is None:
        raise ValueError("Uploaded Excel workbook contains no active sheet.")

    header_row_idx = None
    col_map = {}

    # Detect header row in top 15 rows
    for r_idx in range(1, min(16, sheet.max_row + 1)):
        row_vals = [sheet.cell(row=r_idx, column=c_idx).value for c_idx in range(1, min(25, sheet.max_column + 1))]
        str_vals = [str(v).strip().lower() if v is not None else "" for v in row_vals]

        if any("employee id" in s or "employee_id" in s or "email" in s for s in str_vals):
            header_row_idx = r_idx
            for c_idx, val in enumerate(str_vals, start=1):
                if not val:
                    continue
                if "employee id" in val or "employee_id" in val:
                    col_map["employee_id"] = c_idx
                elif "full name" in val or val == "name":
                    col_map["full_name"] = c_idx
                elif "email" in val:
                    col_map["email"] = c_idx
                elif "password" in val:
                    col_map["password"] = c_idx
                elif "role" in val:
                    col_map["role"] = c_idx
                elif "department" in val:
                    col_map["department"] = c_idx
                elif "designation" in val:
                    col_map["designation"] = c_idx
                elif "status" in val:
                    col_map["status"] = c_idx
                elif "mobile" in val or "phone" in val:
                    col_map["mobile_number"] = c_idx
                elif "storage" in val:
                    col_map["storage"] = c_idx
            break

    if not header_row_idx or ("email" not in col_map and "employee_id" not in col_map):
        raise ValueError(
            "Could not detect valid employee columns in the uploaded Excel sheet. "
            "Please ensure headers include 'Employee ID' or 'Email (Login ID)'."
        )

    updated_count = 0
    errors = []

    for r_idx in range(header_row_idx + 1, sheet.max_row + 1):
        def get_val(key):
            if key in col_map:
                val = sheet.cell(row=r_idx, column=col_map[key]).value
                return str(val).strip() if val is not None else ""
            return ""

        emp_id = get_val("employee_id")
        email = get_val("email").lower()
        full_name = get_val("full_name")
        password = get_val("password")
        role = get_val("role").lower().replace(" ", "").replace("-", "")
        department = get_val("department")
        designation = get_val("designation")
        status = get_val("status").lower()
        mobile = get_val("mobile_number")
        storage_str = get_val("storage")

        if not emp_id and not email and not full_name:
            continue

        user = None
        if emp_id:
            user = db.query(User).filter(User.employee_id == emp_id).first()
        if not user and email:
            user = db.query(User).filter(User.email == email).first()

        if user:
            changed = False
            if full_name and full_name != user.full_name:
                user.full_name = full_name
                changed = True
            if password and password != "(hash secured)" and len(password) >= 6 and password != user.password_reference:
                user.password_reference = password
                user.password_hash = hash_password(password)
                changed = True
            if role in ["employee", "readonlyemployee", "admin"] and role != user.role:
                user.role = role
                changed = True
            if department and department != user.department:
                user.department = department
                changed = True
            if designation and designation != user.designation:
                user.designation = designation
                changed = True
            if status in ["active", "suspended", "pending", "inactive"] and status != user.status:
                user.status = status
                changed = True
            if mobile and mobile != user.mobile_number:
                user.mobile_number = mobile
                changed = True
            if storage_str:
                try:
                    gb_clean = storage_str.upper().replace("GB", "").replace("MB", "").strip()
                    gb_val = float(gb_clean)
                    if "MB" in storage_str.upper():
                        bytes_val = int(gb_val * (1024 ** 2))
                    else:
                        bytes_val = int(gb_val * (1024 ** 3))
                    if bytes_val >= 50 * 1024 * 1024 and bytes_val != user.storage_limit_bytes:
                        user.storage_limit_bytes = bytes_val
                        changed = True
                except Exception:
                    pass

            if changed:
                updated_count += 1
        else:
            errors.append(f"Row {r_idx}: Employee '{emp_id or email}' not found in database.")

    if updated_count > 0:
        db.commit()

    # Re-sync Excel file on disk
    sync_password_documentation_file(db)

    return {
        "updated_count": updated_count,
        "total_rows_scanned": sheet.max_row - header_row_idx,
        "errors": errors,
    }

