# Rejestr CodeArtifact Terraform — Wymagania

> **Aneks AWS dla Modelu 2.** Ta specyfikacja opisuje prywatny rejestr npm jako
> zarządzaną infrastrukturę chmurową: AWS CodeArtifact + Terraform. Zacznij od
> specyfikacji GitHub Packages, chyba że Twój zespół już potrzebuje zarządzania natywnego dla AWS.

## Cel

Utwórz infrastrukturę AWS dla prywatnego rejestru npm za pomocą Terraform.

## Konfiguracja

| Parametr                      | Wartość                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Nazwa domeny                  | `devs10x` (musi zaczynać się małą literą)                                        |
| Region AWS                    | `eu-central-1`                                                                   |
| Bucket stanu S3               | `<your-terraform-state-bucket>` (utwórz go najpierw; nazwy bucketów są globalne) |
| Klucz stanu                   | `codeartifact/terraform.tfstate`                                                 |
| Nazwa prywatnego repozytorium | `npm`                                                                            |
| Nazwa repozytorium proxy      | `npm-store`                                                                      |
| Połączenie zewnętrzne         | `public:npmjs`                                                                   |
| Nazwa projektu                | `<your-project-name>`                                                            |
| ID konta AWS                  | `<your-account-id>`                                                              |

## Wersje Terraform

- Wymagana wersja Terraform: `>= 1.10`
- Wersja dostawcy AWS: `~> 6.0`
- Blokowanie backendu S3: `use_lockfile = true` (natywne blokowanie S3, DynamoDB nie jest potrzebne)

## Tagi

- `Project`: `<your-project-name>`
- `ManagedBy`: `terraform`
- `Environment`: `<your-environment>` (np. `dev`)

## KMS

- Alias klucza: `alias/devs10x-codeartifact`

## Zarządzana polityka IAM

- Nazwa polityki: `devs10x-codeartifact-developer`
- Uprawnienia: uwierzytelnianie domeny, odczyt repozytorium, publikowanie pakietów
- Dołącz do istniejącej roli CI/CD za pomocą `aws_iam_role_policy_attachment`

## Rola GitHub Actions

- Nazwa roli: `github-actions-codeartifact` (istniejąca wcześniej, referencjonowana przez źródło `data`)
- Zarządzana polityka jest dołączona do tej roli, aby CI/CD mogło uwierzytelniać się w CodeArtifact

## Przykład tfvars

```hcl
aws_region     = "eu-central-1"
domain_name    = "devs10x"
aws_account_id = "<your-account-id>"
project_name   = "<your-project-name>"
```

## Logowanie ze zakresem — znana pułapka

Logowanie ze zakresem kieruje wyłącznie zakres Twojego pakietu przez CodeArtifact i pozostawia
wszystko inne w publicznym npm:

```bash
aws codeartifact login --tool npm --domain devs10x --repository npm --namespace 10xdevs
```

`--namespace` przyjmuje zakres pakietu bez `@` (`10xdevs`), a nie
domenę CodeArtifact (`devs10x`). To dwie różne rzeczy:
zakres pakietu `@10xdevs` != domena `devs10x`.
