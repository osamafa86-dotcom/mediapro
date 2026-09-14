# تهيئة سجلّ «سكينة» في App Store Connect قبل رفع البيانات الوصفية — **يكتب**.
#
# ثلاثة أشياء لا يضبطها `deliver` في حالتنا، وغيابها يوقف التقديم بعد رفع كلّ شيء:
#
#   ١) **رقم النسخة يجب أن يطابق CFBundleShortVersionString حرفياً** وإلا لم
#      يظهر البناء في قائمة نسخته أصلاً — والبناء يبقى مرفوعاً سليماً بينما
#      الواجهة تقول «لا بناء مرفق»، وهو أخبثُ فشلٍ في هذه السلسلة.
#   ٢) **الفئة تسكن AppInfo لا App**، فلا يبلغها رفع البيانات الوصفية.
#   ٣) **اسم المتجر** أُنشئ آلياً بالإنجليزية عند تسجيل التطبيق.
#
#   ruby asc_prepare_version.rb <api_key.json> <bundle_id> <version> <name> <primary_cat> [secondary_cat]
require 'spaceship'

key_path, bundle_id, target_version, app_name, primary_cat, secondary_cat = ARGV
unless key_path && bundle_id && target_version && app_name && primary_cat
  abort '✗ الاستعمال: asc_prepare_version.rb <api_key.json> <bundle_id> <version> <name> <primary_cat> [secondary_cat]'
end

Spaceship::ConnectAPI.token = Spaceship::ConnectAPI::Token.from_json_file(key_path)

# المطابقة الحرفية شرطُنا: فلتر ASC يطابق بالبادئة، فـ«…sakinah.native» تطابق
# «…sakinah.native.widget» أيضاً — وضبطُ الودجة بدل التطبيق خطأٌ صامت.
app = Spaceship::ConnectAPI::App.all(filter: { bundleId: bundle_id })
                                .find { |a| a.bundle_id == bundle_id }
abort "✗ لا سجلّ تطبيقٍ للمعرّف #{bundle_id}" if app.nil?
puts "✓ التطبيق: «#{app.name}» · id=#{app.id}"

changed = []

# ── ١) رقم النسخة ──
versions = app.get_app_store_versions
editable = versions.find { |v| %w[PREPARE_FOR_SUBMISSION DEVELOPER_REJECTED REJECTED METADATA_REJECTED].include?(v.app_store_state) }
if editable.nil?
  puts "• لا نسخة قابلة للتحرير — سيُنشئها deliver بالرقم #{target_version}"
elsif editable.version_string == target_version
  puts "• رقم النسخة #{target_version} مضبوط أصلاً"
else
  puts "• إعادة تسمية النسخة #{editable.version_string} ← #{target_version}"
  editable.update(attributes: { versionString: target_version })
  changed << "version #{editable.version_string}→#{target_version}"
end

# ── ٢) الفئة والاسم (كلاهما في AppInfo) ──
info = app.fetch_edit_app_info
abort '✗ لا AppInfo قابلة للتحرير' if info.nil?

cur_primary = (info.primary_category&.id).to_s
cur_secondary = (info.secondary_category&.id).to_s
if cur_primary == primary_cat && (secondary_cat.nil? || cur_secondary == secondary_cat)
  puts "• الفئات مضبوطة أصلاً (#{cur_primary}#{secondary_cat ? " · #{cur_secondary}" : ''})"
else
  # مفاتيح Spaceship snake_case: primary_category_id / secondary_category_id — لا camelCase
  attrs = { primary_category_id: primary_cat }
  attrs[:secondary_category_id] = secondary_cat if secondary_cat
  puts "• ضبط الفئات: #{primary_cat}#{secondary_cat ? " · #{secondary_cat}" : ''} (كانت #{cur_primary.empty? ? '—' : cur_primary})"
  info.update_categories(category_id_map: attrs)
  changed << 'categories'
end

info.get_app_info_localizations.each do |l|
  next unless l.locale == 'ar-SA'
  if l.name == app_name
    puts "• اسم المتجر «#{app_name}» مضبوط أصلاً"
  else
    puts "• اسم المتجر: «#{l.name}» ← «#{app_name}»"
    l.update(attributes: { name: app_name })
    changed << 'name'
  end
end

puts changed.empty? ? "\n✓ لا تغيير — كل شيء مضبوط" : "\n✓ غُيّر: #{changed.join(' · ')}"
