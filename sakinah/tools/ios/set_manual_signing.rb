# فرض التوقيع اليدويّ على هدف App في مشروع Capacitor (ios/App/App.xcodeproj) — يُنادى من سير الإصدار وحده.
# الدرس المقيس في wilt: لا -allowProvisioningUpdates ولا شهادة تُطلب من Apple؛ الشهادة من p12 والملف من sigh،
# والإعداد يُكتب في المشروع لا في سطر الأوامر حتى لا يسري على أهداف Pods.
#   ruby tools/ios/set_manual_signing.rb <TEAM_ID> <اسم ملف provisioning>
require 'xcodeproj'

team, profile = ARGV
abort '✗ الاستعمال: set_manual_signing.rb <TEAM_ID> <اسم ملف provisioning>' if [team, profile].any? { |v| v.to_s.strip.empty? }

proj_path = File.expand_path('../../ios/App/App.xcodeproj', __dir__)
proj = Xcodeproj::Project.open(proj_path)
target = proj.targets.find { |t| t.name == 'App' }
abort '✗ الهدف App غائب — شغّل npx cap add ios أولاً' unless target
target.build_configurations.each do |c|
  bs = c.build_settings
  bs['CODE_SIGN_STYLE'] = 'Manual'
  bs['DEVELOPMENT_TEAM'] = team
  bs['PROVISIONING_PROFILE_SPECIFIER'] = profile
  bs['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  bs['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'
end
proj.save
puts "✓ توقيعٌ يدويّ: App ← #{profile} (فريق #{team})"
