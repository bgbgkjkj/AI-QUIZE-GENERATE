from django.core.management.base import BaseCommand
from quiz_app.models import Category, Level, Subject

class Command(BaseCommand):
    help = 'Seeds the database with initial categories, levels, and subjects'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding database...')

        # Data Structure
        data = {
            'Academics': {
                'icon': 'GraduationCap',
                'description': 'School and College subjects',
                'levels': {
                    '10th Grade': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
                    '12th Grade': ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
                }
            },
            'Computer Science': {
                'icon': 'Code2',
                'description': 'Programming and Engineering subjects',
                'levels': {
                    'Core Subjects': ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks'],
                    'Programming': ['Python', 'Java', 'C/C++', 'Web Development', 'Object Oriented Programming'],
                }
            },
            'Government Exams': {
                'icon': 'Briefcase',
                'description': 'Competitive exams preparation',
                'levels': {
                    'National Level': ['UPSC Civil Services', 'SSC CGL', 'SSC CHSL', 'Banking Exams'],
                    'State Level': ['State PSC', 'Police Exams', 'Teaching Exams'],
                }
            }
        }

        for cat_name, cat_data in data.items():
            category, created = Category.objects.get_or_create(
                name=cat_name,
                defaults={
                    'description': cat_data['description'],
                    'icon': cat_data['icon']
                }
            )
            if created:
                self.stdout.write(f'Created Category: {cat_name}')
            
            for level_name, subjects in cat_data['levels'].items():
                level, l_created = Level.objects.get_or_create(
                    name=level_name,
                    category=category,
                    defaults={'description': f'{level_name} level subjects'}
                )
                if l_created:
                    self.stdout.write(f'  Created Level: {level_name}')

                for subject_name in subjects:
                    subject, s_created = Subject.objects.get_or_create(
                        name=subject_name,
                        level=level,
                        defaults={'description': f'{subject_name} quiz'}
                    )
                    if s_created:
                        self.stdout.write(f'    Created Subject: {subject_name}')

        self.stdout.write(self.style.SUCCESS('Successfully seeded database!'))
