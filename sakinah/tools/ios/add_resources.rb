# إضافة ملفات موارد (صوت الأذان القصير، بيان الخصوصية) إلى هدف App في مشروع Xcode المولَّد بـ Capacitor.
# الاستخدام: ruby tools/ios/add_resources.rb ios/App/App.xcodeproj ios/App/App/adhan_short.wav ios/App/App/PrivacyInfo.xcprivacy
require 'xcodeproj'

proj_path = ARGV.shift or abort 'usage: add_resources.rb <project.xcodeproj> <file>...'
files = ARGV
abort 'no files given' if files.empty?
project = Xcodeproj::Project.open(proj_path)
target = project.targets.find { |t| t.name == 'App' } or abort 'target App not found'
group = project.main_group.find_subpath('App', true)
files.each do |path|
  abort "missing file #{path}" unless File.exist?(path)
  name = File.basename(path)
  existing = group.files.find { |f| f.path == name || f.path == path }
  ref = existing || group.new_file(File.expand_path(path))
  unless target.resources_build_phase.files_references.include?(ref)
    target.add_resources([ref])
    puts "added #{name} to App resources"
  else
    puts "#{name} already in resources"
  end
end
project.save
puts 'project saved'
