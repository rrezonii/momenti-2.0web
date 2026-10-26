from argostranslate import package


def main():
    package.update_package_index()
    match = next(
        (
            item
            for item in package.get_available_packages()
            if item.from_code == "sq" and item.to_code == "en"
        ),
        None,
    )
    if match is None:
        raise RuntimeError("Argos Translate has no Albanian-to-English package in its package index.")
    downloaded = match.download()
    package.install_from_path(downloaded)
    print("Installed the local Argos Translate sq -> en language model.")


if __name__ == "__main__":
    main()
