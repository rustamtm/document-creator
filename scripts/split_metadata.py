import argparse
import csv
from pathlib import Path
from typing import List


def read_metadata(path: Path) -> List[str]:
    with path.open("r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


def write_metadata(path: Path, rows: List[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        for row in rows:
            f.write(row + "\n")


def split_meta(meta_path: Path) -> None:
    rows = read_metadata(meta_path)
    rows.sort(key=lambda r: r.split("|")[0])
    n = len(rows)
    train_end = int(n * 0.9)
    val_end = train_end + int(n * 0.05)
    train_rows = rows[:train_end]
    val_rows = rows[train_end:val_end]
    test_rows = rows[val_end:]
    write_metadata(meta_path.parent / "metadata_train.csv", train_rows)
    write_metadata(meta_path.parent / "metadata_val.csv", val_rows)
    write_metadata(meta_path.parent / "metadata_test.csv", test_rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Split metadata.csv into train/val/test")
    parser.add_argument("meta_file", help="Path to metadata.csv")
    args = parser.parse_args()
    split_meta(Path(args.meta_file))


if __name__ == "__main__":
    main()
