# تسجيل معرّف حزمة سكينة في بوابة مطوّري Apple عبر App Store Connect API (يكفيها دور App Manager).
# نسخة من مستودع wilt (mobile/tool/asc_register_bundle_id.rb) — Spaceship مباشرةً، وبفشلٍ عالي الصوت. idempotent.
#   ruby tools/ios/asc_register_bundle_id.rb <api_key.json> <bundle_id> <الاسم>
require 'spaceship'

key_path, bundle_id, name = ARGV
abort '✗ الاستعمال: asc_register_bundle_id.rb <api_key.json> <bundle_id> <الاسم>' if !key_path || !bundle_id || !name

Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.from_json_file(key_path)
found = Spaceship::ConnectAPI::BundleId.all(filter: { identifier: bundle_id }).find { |b| b.identifier == bundle_id }
if found
  puts "✓ المعرّف #{bundle_id} مسجّل أصلاً"
else
  Spaceship::ConnectAPI::BundleId.create(name: name, identifier: bundle_id, platform: 'IOS')
  puts "✓ سُجّل المعرّف #{bundle_id}"
end
